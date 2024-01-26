import Middleware from "./middleware";

const r = 'readonly', rw = 'readwrite';
const s = 'store';

/**
 * Vault is an asynchronous key/value store similar to localStorage, but
 * with the following differences:
 * - It is asynchronous.
 * - It provides a middleware mechanism to intercept and modify data.
 * - It is an extensible class that can be extended to provide additional
 *   functionality.
 * - It let to store any type of data, not just strings.
 * - You can store large amounts of data, not just 5MB.
 */
export default class Vault {
  #dbName = 'vault';
  #db: IDBDatabase | null = null; #m: Middleware[] = [];

  // Fake custom properties support. Custom properties are stored in the
  // indexdb as key/value pairs. This is a workaround to allow custom
  // properties to be set and retrieved as if they were native properties.
  [key: string]: any;

  constructor(dbName?: string) {
    this.#dbName = dbName || this.#dbName;
    return new Proxy(this, proxyHandler);
  }

  setItem     = async (key: string, value: any): Promise<void>  => this.#do(rw, store => store.put({ key, value }))
  getItem     = async (key: string): Promise<any>               => this.#do(r, store => store.get(key)).then(result => result?.value ?? null)


  removeItem  = async (key: string):Promise<void> => this.#do(rw, store => store.delete(key))
  clear       = async (): Promise<void>           => this.#do(rw, store => store.clear())

  keys        = async (): Promise<string[]>       => this.#do(r, store => store.getAllKeys())
  length      = async (): Promise<number>         => this.#do(r, store => store.count())

  #init = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, 1)
      request.onupgradeneeded = (e:any) => {
        e.target.result.createObjectStore(s, { keyPath: 'key' })
      }
      request.onsuccess = () => {this.#db = request.result;resolve()}
      request.onerror = (e) => reject(e)
    })
  }

  #do = async (operationType: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<any> => {
    if (!this.#db) await this.#init()
    const transaction = this.#db!.transaction(s, operationType);
    const request     = operation(transaction.objectStore(s));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(operationType === r ? request.result : undefined);
      request.onerror   = () => reject(request.error);
    });
  }
}

const proxyHandler = {
  get(target: any, key: string)             { return (typeof target[key] === 'function') ? target[key].bind(target) : key in target ? target[key] : target.getItem(key) },
  set(target: any, key: string, value: any) { return target.setItem(key, value) },
  deleteProperty(target: any, key: string)  { return target.removeItem(key) }
};
