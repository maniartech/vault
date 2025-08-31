import proxy from "./proxy-handler.js";
// Create a frozen, non-modifiable copy of the proxy handler for safe external use
const __frozenProxyHandler = Object.freeze({ ...proxy });
import { VaultItem, VaultItemMeta } from './types/vault.js';
import { Middleware, MiddlewareContext } from './types/middleware.js';
import { ValidationError } from './middlewares/validation.js';

const r = 'readonly', rw = 'readwrite';
const s = 'store';

// Internal event types for the events system
type ChangeOp = "set" | "remove" | "clear";
type ChangeEvent = { op: ChangeOp; key?: string; meta?: any; version?: number };

/**
 * Vault is an asynchronous key/value store similar to localStorage, but
 * provides a more flexible and powerful storage mechanism.
 */
export default class Vault {
  /** Name of the storage database */
  protected storageName: string = 'vault-storage';
  /** IndexedDB database handle (initialized lazily) */
  protected db: IDBDatabase | null = null;
  /** Registered middlewares for the pipeline */
  public middlewares: Middleware[] = [];
  /** Internal event bus (same-process) */
  private __bus = new EventTarget();
  /** Optional DOM-like property handler for convenience */
  public onchange?: (e: CustomEvent<ChangeEvent>) => void;
  [key: string]: any;

  /**
   * Creates new custom instance of custom Vault Storage.
   * @param {string} [storageName] - The name of the storage.
   * @param {boolean} [isParent=false] - A flag to indicate if this instance
   * is a parent. This property should be ignored by the user unless they are
   * extending the Vault class.
   */
  public constructor(storageName?: string, isParent: boolean = false) {
    this.storageName = storageName || this.storageName;
    // Use instanceToProxy if provided, otherwise default to this
    if (!isParent) {
  const p = new Proxy(this, proxy);
  // Philosophy
  // -----------
  // We store a hidden back-reference to the proxy created for this instance.
  // Why? So that chainable instance methods (e.g. use()) can return the exact
  // same proxy object the caller already holds. This preserves identity
  // (result === vault) in fluent chains and avoids exposing the raw target.
  //
  // Design choices:
  // - Non-enumerable: won't appear in for..in/Object.keys/JSON, keeping the
  //   surface clean and preventing accidental leaks.
  // - Non-configurable & non-writable: prevents tampering or deletion.
  // - We return the proxy `p` from the constructor so external code always
  //   talks to the proxy, not the underlying instance.
  // - Casting (this as any) is used only to attach this internal field
  //   without polluting the public type surface. Alternatives could be a
  //   WeakMap or a Symbol key, but defineProperty here keeps it simple and
  //   predictable.
  //
  // Maintainers:
  // If you add new chainable methods that should preserve identity equality
  // with the proxy (e.g. return `this` for chaining), prefer returning
  // `(this as any).__selfProxy ?? this` to ensure callers keep the same proxy.
  Object.defineProperty(this as any, '__selfProxy', {
        value: p,
        enumerable: false,
        configurable: false,
        writable: false
      });
      return p;
    }
  }

  /**
   * Set an item in the database with additional metadata.
   * @param {string} key - The key of the item.
   * @param {any} value - The value of the item.
   * @param {any} meta - The metadata for the item (e.g., ttl, expiration) or
   *                     any other data that should be stored alongside the value.
   * @returns {Promise<void>}
   */
  /**
   * Store an item with optional metadata.
   */
  public async setItem<T = unknown>(key: string, value: T, meta: VaultItemMeta | null = null): Promise<void> {
    const context: MiddlewareContext = {
      operation: 'set',
      key,
      value,
      meta
    };

    return this.executeWithMiddleware(context, async () => {
      // The core operation now only performs the put, validation is centralized
      const result = await this.do(rw, (store: IDBObjectStore) => store.put({
        key: context.key as string,
        value: context.value as T,
        meta: (context.meta ?? null) as VaultItemMeta | null
      } as any));

      // Emit change event after successful storage operation
      this.__emit({
        op: "set",
        key: context.key as string,
        meta: context.meta,
        version: Date.now()
      });

      return result;
    });
  }

  /**
   * Get an item from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<any>} - The value of the item.
   */
  /**
   * Retrieve an item by key.
   * Returns null when no record exists, or the stored value (which may be undefined).
   */
  public async getItem<T = unknown>(key: string): Promise<T | null | undefined> {
    const context: MiddlewareContext = {
      operation: 'get',
      key
    };

    return this.executeWithMiddleware(context, async () => {
      const record = await this.do<VaultItem<T>>(r, (store: IDBObjectStore) => store.get(context.key as string));
      context.meta = record?.meta ?? null;
      context.value = record == null ? null : record.value;
      return record == null ? null : record.value;
    });
  }

  /**
   * Remove an item from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<void>}
   */
  /**
   * Remove an item by key.
   */
  public async removeItem(key: string): Promise<void> {
    const context: MiddlewareContext = {
      operation: 'remove',
      key
    };

    return this.executeWithMiddleware(context, async () => {
      const record = await this.do<VaultItem>(r, (store: IDBObjectStore) => store.get(context.key as string));
      context.meta = record?.meta ?? null;
      context.value = record?.value ?? null;

      const result = await this.do(rw, (store: IDBObjectStore) => store.delete(context.key as string));

      // Emit change event after successful removal
      this.__emit({
        op: "remove",
        key: context.key as string,
        meta: context.meta,
        version: Date.now()
      });

      return result;
    });
  }

 /**
  * Clear all items from the vault.
  *
  * Why confirm?
  * Clearing all data is a destructive operation. Middleware can opt-in to
  * require an explicit confirmation to prevent accidental data loss
  * (for example, a validation/compliance "safety lock"). When such a guard is
  * installed, calling `clear()` without confirmation will be rejected. Passing
  * `true` explicitly acknowledges the destructive operation and allows it to proceed.
  *
  * Example (middleware guard requiring confirmation):
  *
  *   const guard = {
  *     async before(ctx) {
  *       if (ctx.operation === 'clear' && !ctx.confirmClear) {
  *         // Throw your own error type if desired
  *         throw new Error('Clear operation requires confirmation');
  *       }
  *       return ctx;
  *     }
  *   };
  *   vault.use(guard);
  *
  *   // Without confirmation: rejected by guard
  *   await vault.clear();
  *
  *   // With confirmation: proceeds and clears all data
  *   await vault.clear(true);
  *
  * Notes:
  * - The `confirm` parameter is forwarded to middleware as `context.confirmClear`.
  * - This flag is only consulted when a middleware chooses to enforce it; without
  *   such a guard, `clear()` will behave as usual and remove all items.
  *
  * @param {boolean} [confirm] - Pass true to confirm bulk clear when validators require it.
  * @returns {Promise<void>}
  */
  public async clear(confirm?: boolean): Promise<void> {
    const confirmClear = confirm;
    const context: MiddlewareContext = {
      operation: 'clear',
      confirmClear
    };

    return this.executeWithMiddleware(context, async () => {
      const result = await this.do(rw, (store: IDBObjectStore) => store.clear());

      // Emit change event after clearing storage
      this.__emit({
        op: "clear",
        version: Date.now()
      });

      return result;
    });
  }

  /**
   * Get all keys in the database.
   * @returns {Promise<string[]>} - An array of keys.
   */
  /**
   * Get all keys stored in the vault.
   */
  public async keys(): Promise<IDBValidKey[]> {
    const context: MiddlewareContext = {
      operation: 'keys'
    };

    return this.executeWithMiddleware(context, async () => {
      return this.do<IDBValidKey[]>(r, (store: IDBObjectStore) => store.getAllKeys());
    });
  }

  /**
   * Get the number of items in the database.
   * @returns {Promise<number>} - The number of items.
   */
  /**
   * Get the total number of items stored in the vault.
   */
  public async length(): Promise<number> {
    const context: MiddlewareContext = {
      operation: 'length'
    };

    return this.executeWithMiddleware(context, async () => {
      return this.do<number>(r, (store: IDBObjectStore) => store.count());
    });
  }

  /**
   * Get an item's metadata from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<any>} - The metadata of the item.
   */
  /**
   * Get metadata for an item by key.
   */
  public async getItemMeta(key: string): Promise<VaultItemMeta | null> {
    const context: MiddlewareContext = {
      operation: 'getItemMeta',
      key
    };

    return this.executeWithMiddleware(context, async () => {
      const record = await this.do<VaultItem>(r, (store: IDBObjectStore) => store.get(context.key as string));
      context.meta = record?.meta ?? null;
      context.value = record?.value ?? null;
      return record?.meta ?? null;
    });
  }

  /**
   * Register a middleware to be used in the vault operations pipeline.
   * @param {Middleware} middleware - The middleware to register.
   * @returns {Vault} - Returns this instance for method chaining.
   */
  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    if (typeof middleware.onRegister === 'function') {
      middleware.onRegister((this as any).__selfProxy ?? this);
    }
    // If this instance is proxied, return the proxy to preserve identity in chaining
    const sp = (this as any).__selfProxy;
    return (sp ?? this) as this;
  }

  /**
   * Add an event listener to the vault.
   * @param {string} type - The event type to listen for.
   * @param {EventListenerOrEventListenerObject} listener - The event listener function.
   * @param {boolean | AddEventListenerOptions} [options] - Optional event listener options.
   */
  public addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.__bus.addEventListener(type, listener as any, options as any);
  }

  /**
   * Remove an event listener from the vault.
   * @param {string} type - The event type to remove the listener from.
   * @param {EventListenerOrEventListenerObject} listener - The event listener function to remove.
   * @param {boolean | EventListenerOptions} [options] - Optional event listener options.
   */
  public removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    this.__bus.removeEventListener(type, listener as any, options as any);
  }

  /**
   * Dispatch an event on the vault.
   * @param {Event} event - The event to dispatch.
   * @returns {boolean} - Whether the event was successfully dispatched.
   */
  public dispatchEvent(event: Event): boolean {
    return this.__bus.dispatchEvent(event);
  }

  /**
   * Emit an internal change event.
   * @param {ChangeEvent} ev - The change event to emit.
   */
  private __emit(ev: ChangeEvent) {
    const evt = new CustomEvent<ChangeEvent>("change", { detail: ev });
    this.__bus.dispatchEvent(evt);
    // Optional DOM-like handler
    if (typeof this.onchange === "function") {
      try {
        this.onchange(evt as any);
      } catch {
        // Silently catch errors in onchange handler
      }
    }
  }

  /**
   * Execute an operation through the middleware pipeline.
   * @param {MiddlewareContext} context - The operation context.
   * @param {Function} operation - The core operation to execute.
   * @returns {Promise<any>} - The result of the operation.
   */
  /**
   * Execute an operation through the middleware pipeline.
   * Returns the result of the operation or null if an error was handled by middleware.
   */
  protected async executeWithMiddleware(context: MiddlewareContext, operation: () => Promise<any>): Promise<any> {
    let modifiedContext: MiddlewareContext = { ...context, vaultInstance: this };
    try {
      // Centralized validation for all operations that require a key
      if (['get', 'set', 'remove', 'getItemMeta'].includes(context.operation)) {
        if (!context.key || typeof context.key !== 'string' || !context.key.trim()) {
          throw new ValidationError('Key must be a non-empty string');
        }
      }

      // For any operation with a key, fetch the previous state before any middleware runs
      if (context.key) {
        const existingRecord = await this.do<VaultItem>(r, (store: IDBObjectStore) => store.get(context.key as string));
        modifiedContext.previousValue = existingRecord ? existingRecord.value : null;
        modifiedContext.previousMeta = existingRecord ? existingRecord.meta : null;
      }

      // Run before hooks
      for (const middleware of this.middlewares) {
        if (middleware.before) {
          const result = await middleware.before(modifiedContext);
          if (result) {
            modifiedContext = result;
          }
        }
      }

      // Propagate any modifications back to the original context
      Object.assign(context, modifiedContext);

      // Execute the core operation
      let result = await operation();

      // Copy context values set by the operation for 'after' hooks
      if (context.value !== undefined) {
        modifiedContext.value = context.value;
      }
      if (context.meta !== undefined) {
        modifiedContext.meta = context.meta;
      }

      // Run after hooks
      for (const middleware of this.middlewares) {
        if (middleware.after) {
          result = await middleware.after(modifiedContext, result);
        }
      }

      return result;
    } catch (error) {
      let handledError = error as Error;

      // Run error hooks
      for (const middleware of this.middlewares) {
        if (middleware.error) {
          const errorResult = await middleware.error(modifiedContext, handledError);
          if (errorResult instanceof Error) {
            handledError = errorResult;
          } else if (errorResult === undefined) {
            return null; // Error was handled by middleware
          }
        }
      }

      throw handledError;
    }
  }

  /**
   * Open the underlying database.
   * @returns {Promise<IDBDatabase>} - The opened database.
   */
  protected async openDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.storageName, 1);

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        if (this.db) {
          resolve(this.db);
        } else {
          reject(new Error('Database connection is null.'));
        }
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore(s, { keyPath: 'key' });
      };
    });
  }

  /**
   * Perform a database operation.
   * @param {string} mode - The transaction mode ('readonly' or 'readwrite').
   * @param {Function} operation - The operation to perform with the transaction and store.
   * @returns {Promise<any>} - The result of the operation.
   */
  protected async do<T>(mode: 'readonly' | 'readwrite', operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(s, mode);
      const store = transaction.objectStore(s);
      const request = operation(store);

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest<T>).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBRequest<T>).error);
      };
    });
  }

  /**
   * Return a non-modifiable copy of the internal Proxy handler used for instances.
   * This enables advanced scenarios (e.g., subclass proxies) without exposing
   * a mutable handler object. The returned handler is frozen and safe to share.
   */
  public static getProxy() {
    return __frozenProxyHandler;
  }
}

// Expose a read-only, non-configurable static accessor for the proxy handler.
// This allows advanced subclassing without making the handler mutable or part of
// the public surface in a way that can be overwritten at runtime.
Object.defineProperty(Vault, 'proxy', {
  get: () => Vault.getProxy(),
  configurable: false,
  enumerable: false
});

// Note: v2 removes the legacy `proxyHandler` alias; use `Vault.proxy` or `Vault.getProxy()`.