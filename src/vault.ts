import proxy from "./proxy-handler.js";
// Create a frozen, non-modifiable copy of the proxy handler for safe external use
const __frozenProxyHandler = Object.freeze({ ...proxy });
import { VaultItemMeta } from './types/vault.js';
import { Middleware, MiddlewareContext } from './types/middleware.js';

const r = 'readonly', rw = 'readwrite';
const s = 'store';

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
    if (!isParent) return new Proxy(this, proxy)
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
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      return this.do(rw, (store) => store.put({
        key: context.key as string,
        value: context.value as T,
        meta: (context.meta ?? null) as VaultItemMeta | null
      } as any));
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
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      return this
        .do(r, (store) => store.get(context.key as string) as IDBRequest<any>)
        .then((record) => (record == null ? null : (record as any).value as T | undefined));
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
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      return this.do(rw, (store) => store.delete(context.key as string));
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
      return this.do(rw, (store) => store.clear());
    });
  }

  /**
   * Get all keys in the database.
   * @returns {Promise<string[]>} - An array of keys.
   */
  /**
   * Get all keys stored in the vault.
   */
  public async keys(): Promise<string[]> {
    const context: MiddlewareContext = {
      operation: 'keys'
    };

    return this.executeWithMiddleware(context, async () => {
      return this.do(r, (store) => store.getAllKeys() as IDBRequest<string[]>);
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
      return this.do(r, (store) => store.count() as IDBRequest<number>);
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
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      return this
        .do(r, (store) => store.get(context.key as string) as IDBRequest<any>)
        .then((record) => (record?.meta ?? null));
    });
  }

  /**
   * Register a middleware to be used in the vault operations pipeline.
   * @param {Middleware} middleware - The middleware to register.
   * @returns {Vault} - Returns this instance for method chaining.
   */
  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
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
      // Run before hooks
      for (const middleware of this.middlewares) {
        if (middleware.before) {
          modifiedContext = await middleware.before(modifiedContext);
        }
      }

    // IMPORTANT: propagate any modifications back to the original context
    // so the core operation uses updated key/value/meta set by 'before' hooks
    Object.assign(context, modifiedContext);

      // Execute the core operation
      let result = await operation();

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
            // If middleware returns undefined, it handled the error
            return null;
          }
        }
      }

  throw handledError;
    }
  }

  // Initialize the database and return a promise.
  /** Initialize IndexedDB database lazily. */
  protected async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.storageName, 1);
      request.onupgradeneeded = (e: any) => {
    (e.target as IDBRequest).result.createObjectStore(s, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = (e) => {
        reject(new Error(`Failed to open database: ${e}`));
      };
    });
  }

  // Execute a transaction and return a promise.
  protected async do(operationType: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<any> {
    if (!this.db) await this.init();
    const transaction = this.db!.transaction(s, operationType);
    const store = transaction.objectStore(s);
    const request = operation(store);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(operationType === r ? (request as IDBRequest).result : undefined);
      };
      request.onerror = () => {
        reject(new Error(`Database operation failed: ${request.error?.message || 'Unknown error'}`));
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