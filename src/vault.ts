import proxyHandler from "./proxy-handler";

const r = 'readonly', rw = 'readwrite';
const s = 'store';

/**
 * Vault is an asynchronous key/value store similar to localStorage, but
 * with the following differences:
 * - It is asynchronous.
 * - It is an extensible class that can be extended to provide additional
 *   functionality.
 * - It let to store any type of data, not just strings.
 * - You can store large amounts of data, not just 5MB.
 * @property {string} storageName - The name of the database.
 * @property {IDBDatabase|null} db - The database instance.
 */
export default class Vault {
  protected storageName = 'vault';
  protected db: IDBDatabase | null = null;

  /**
   * Creates new custom instance of custom Vault Storage.
   * @param {string} [storageName] - The name of the storage.
   * @param {boolean} [isParent=false] - A flag to indicate if this instance is a parent.
   */
  constructor(storageName?: string, isParent: boolean = false) {
    this.storageName = storageName || this.storageName;
    // Use instanceToProxy if provided, otherwise default to this
    if (!isParent) return new Proxy(this, proxyHandler)
  }

  /**
   * Set an item in the database.
   * @param {string} key - The key of the item.
   * @param {any} value - The value of the item.
   * @returns {Promise<void>}
   */
  async setItem(key: string, value: any): Promise<void> {
    return this.do(rw, (s:any) => s.put({ key, value }))
  }

  /**
   * Get an item from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<any>} - The value of the item.
   */
  async getItem(key: string): Promise<any>  {
    return this.do(r, (s: any) => s.get(key)).then((r:any) => r?.value ?? null)
  }

  /**
   * Remove an item from the database.
   * @param {string} key - The key of the item.
   * @returns {Promise<void>}
   */
  async removeItem(key: string):Promise<void>             { return this.do(rw, (s:any) => s.delete(key)) }

  /**
   * Clear the database.
   * @returns {Promise<void>}
   */
  async clear(): Promise<void>                            { return this.do(rw, (s:any) => s.clear()) }

  /**
   * Get all keys in the database.
   * @returns {Promise<string[]>} - An array of keys.
   */
  async keys(): Promise<string[]>                         { return this.do(r, (s:any) => s.getAllKeys()) }

  /**
   * Get the number of items in the database.
   * @returns {Promise<number>} - The number of items.
   */
  async length(): Promise<number>                         { return this.do(r, (s:any) => s.count()) }

  // Initialize the database and return a promise.
  protected async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.storageName, 1)
      request.onupgradeneeded = (e:any) => {
        e.target.result.createObjectStore(s, { keyPath: 'key' })
      }
      request.onsuccess = () => {this.db = request.result;resolve()}
      request.onerror = (e) => reject(e)
    })
  }


  // Execute a transaction and return a promise.
  protected async do(operationType: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<any> {
    if (!this.db) await this.init()
    const transaction = this.db!.transaction(s, operationType);
    const request     = operation(transaction.objectStore(s));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(operationType === r ? request.result : undefined);
      request.onerror   = () => reject(request.error);
    });
  }
}