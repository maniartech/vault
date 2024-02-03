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
 */
export default class Vault {
  dbName = 'vault';
  db: IDBDatabase | null = null;

  // Fake custom properties support. Custom properties are stored in the
  // indexdb as key/value pairs. This is a workaround to allow custom
  // properties to be set and retrieved as if they were native properties.
  [key: string]: any;

  constructor(dbName?: string, isParent: boolean = false) {
    this.dbName = dbName || this.dbName;
    // Use instanceToProxy if provided, otherwise default to this
    if (!isParent) return new Proxy(this, proxyHandler)
  }

  async setItem(key: string, value: any): Promise<void>   { return this.do(rw, (s:any) => s.put({ key, value })) }
  async getItem(key: string): Promise<any>                { return this.do(r, (s: any) => s.get(key)).then((r:any) => r?.value ?? null) }
  async removeItem(key: string):Promise<void>             { return this.do(rw, (s:any) => s.delete(key)) }
  async clear(): Promise<void>                            { return this.do(rw, (s:any) => s.clear()) }
  async keys(): Promise<string[]>                         { return this.do(r, (s:any) => s.getAllKeys()) }
  async length(): Promise<number>                         { return this.do(r, (s:any) => s.count()) }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      request.onupgradeneeded = (e:any) => {
        e.target.result.createObjectStore(s, { keyPath: 'key' })
      }
      request.onsuccess = () => {this.db = request.result;resolve()}
      request.onerror = (e) => reject(e)
    })
  }

  async do(operationType: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<any> {
    if (!this.db) await this.init()
    const transaction = this.db!.transaction(s, operationType);
    const request     = operation(transaction.objectStore(s));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(operationType === r ? request.result : undefined);
      request.onerror   = () => reject(request.error);
    });
  }
}

