import proxyHandler from "./proxy-handler.js";
import { VaultItemMeta } from './types/vault.js';
import { Middleware, MiddlewareContext } from './types/middleware.js';

const r = 'readonly', rw = 'readwrite';
const s = 'store';

/**
 * Vault is an asynchronous key/value store similar to localStorage, but
 * provides a more flexible and powerful storage mechanism.
 */
export default class Vault {
  protected storageName = 'vault-storage';
  protected db: IDBDatabase | null = null;
  protected middlewares: Middleware[] = [];
  [key: string]: any;

  /**
   * Creates new custom instance of custom Vault Storage.
   * @param {string} [storageName] - The name of the storage.
   * @param {boolean} [isParent=false] - A flag to indicate if this instance
   * is a parent. This property should be ignored by the user unless they are
   * extending the Vault class.
   */
  constructor(storageName?: string, isParent: boolean = false) {
    this.storageName = storageName || this.storageName;
    // Use instanceToProxy if provided, otherwise default to this
    if (!isParent) return new Proxy(this, proxyHandler)
  }

  /**
   * Set an item in the database with additional metadata.
   * @param {string} key - The key of the item.
   * @param {any} value - The value of the item.
   * @param {any} meta - The metadata for the item (e.g., ttl, expiration) or
   *                     any other data that should be stored alongside the value.
   * @returns {Promise<void>}
   */
  async setItem(key: string, value: any, meta: VaultItemMeta | null = null): Promise<void> {
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
      return this.do(rw, (s: any) => s.put({
        key: context.key,
        value: context.value,
        meta: context.meta
      }));
    });
  }

  /**
   * Get an item from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<any>} - The value of the item.
   */
  async getItem(key: string): Promise<any> {
    const context: MiddlewareContext = {
      operation: 'get',
      key
    };

    return this.executeWithMiddleware(context, async () => {
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
  return this.do(r, (s: any) => s.get(context.key)).then((r: any) => (r == null ? null : r.value));
    });
  }

  /**
   * Remove an item from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<void>}
   */
  async removeItem(key: string): Promise<void> {
    const context: MiddlewareContext = {
      operation: 'remove',
      key
    };

    return this.executeWithMiddleware(context, async () => {
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      return this.do(rw, (s: any) => s.delete(context.key));
    });
  }

  /**
   * Clear the database.
   * @returns {Promise<void>}
   */
  async clear(): Promise<void> {
    const context: MiddlewareContext = {
      operation: 'clear'
    };

    return this.executeWithMiddleware(context, async () => {
      return this.do(rw, (s: any) => s.clear());
    });
  }

  /**
   * Get all keys in the database.
   * @returns {Promise<string[]>} - An array of keys.
   */
  async keys(): Promise<string[]> {
    const context: MiddlewareContext = {
      operation: 'keys'
    };

    return this.executeWithMiddleware(context, async () => {
      return this.do(r, (s: any) => s.getAllKeys());
    });
  }

  /**
   * Get the number of items in the database.
   * @returns {Promise<number>} - The number of items.
   */
  async length(): Promise<number> {
    const context: MiddlewareContext = {
      operation: 'length'
    };

    return this.executeWithMiddleware(context, async () => {
      return this.do(r, (s: any) => s.count());
    });
  }

  /**
   * Get an item's metadata from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<any>} - The metadata of the item.
   */
  async getItemMeta(key: string): Promise<any> {
    const context: MiddlewareContext = {
      operation: 'getItemMeta',
      key
    };

    return this.executeWithMiddleware(context, async () => {
      if (!context.key || typeof context.key !== 'string') {
        throw new Error('Key must be a non-empty string');
      }
      return this.do(r, (s: any) => s.get(context.key)).then((r: any) => r?.meta ?? null);
    });
  }

  /**
   * Register a middleware to be used in the vault operations pipeline.
   * @param {Middleware} middleware - The middleware to register.
   * @returns {Vault} - Returns this instance for method chaining.
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute an operation through the middleware pipeline.
   * @param {MiddlewareContext} context - The operation context.
   * @param {Function} operation - The core operation to execute.
   * @returns {Promise<any>} - The result of the operation.
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
  protected async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.storageName, 1);
      request.onupgradeneeded = (e: any) => {
        e.target.result.createObjectStore(s, { keyPath: 'key' });
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
        resolve(operationType === r ? request.result : undefined);
      };
      request.onerror = () => {
        reject(new Error(`Database operation failed: ${request.error?.message || 'Unknown error'}`));
      };
    });
  }
}