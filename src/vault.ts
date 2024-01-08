import Middleware from "./middleware";

const r = 'readonly', rw = 'readwrite';

class Vault {
  #n = location.host; #s = 'vault';
  #d: IDBDatabase | null = null; #m: Middleware[] = [];

  // Fake custom properties support. Custom properties are stored in the
  // indexdb as key/value pairs. This is a workaround to allow custom
  // properties to be set and retrieved as if they were native properties.
  [key: string]: any;

  constructor(s?: string, dn?: string) {
    this.#n = dn || this.#n;
    this.#s = s  || this.#s;
    return new Proxy(this, proxyHandler);
  }

  setItem     = async (key: string, value: any) => this.#do(rw, store => store.put({ key, value }))
  getItem     = async (key: string) => this.#do(r, store => store.get(key)).then(result => result?.value ?? null)
  removeItem  = async (key: string) => this.#do(rw, store => store.delete(key))
  clear       = async () => this.#do(rw, store => store.clear())
  keys        = async () => this.#do(r, store => store.getAllKeys())
  length      = async () => this.#do(r, store => store.count())

  #init = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#n, 1);
      request.onupgradeneeded = (event) => request.result.createObjectStore(this.#s, { keyPath: 'key' })
      request.onsuccess = () => {this.#d = request.result;resolve()}
      request.onerror = (event) => reject(event)
    })
  }

  #do = async (operationType: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<any> => {
    if (!this.#d) await this.#init();

    const transaction = this.#d!.transaction(this.#s, operationType);
    const request     = operation(transaction.objectStore(this.#s));

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

export default Vault;
