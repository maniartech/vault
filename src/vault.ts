import Middleware from "./middleware"

const rw = 'readwrite'
const r = 'readonly'

class Vault {

  constructor(d:string = location.host, s:string = 'vault') {
    this.#init(d, s).then(db => this.#d = db)
    return Object.freeze(new Proxy(this, proxyHandler))
  }

  // read-write operations
  async setItem(key: string, value: any)  : Promise<void> {return this.#do(rw, s => s.put({ key, value }))}
  async removeItem(key: string)           : Promise<void> {return this.#do(rw, s => s.delete(key))}
  async clear()                           : Promise<void> {return this.#do(rw, s => s.clear())}

  // read-only operations
  async getItem(key: string)              : Promise<any>      {return this.#do(r, s => s.get(key)).then(result => result ? result.value : null)}
  async length()                          : Promise<number>   {return this.#do(r, s => s.count())}
  async keys()                            : Promise<string[]> {return this.#do(r, s => s.getAllKeys())}

  [key: string]: any

  // Private Area
  #d = null as IDBDatabase | null; #s = 'vault' // database and store names
  #m: Middleware[] = []

  async #do(operationType: IDBTransactionMode,operation: (store: IDBObjectStore) => IDBRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = operation(this.#d!.transaction(this.#s, operationType).objectStore(this.#s))
      request.onsuccess = () => {
        // middlewares
        let result = request.result; this.#m.forEach(m => { result = m(result, operation.name) })
        resolve(operationType === r ? result : void 0)
      }
      request.onerror = (event) => reject(event)})
  }

  async #init(dbName:string, storeName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)
      this.#s = storeName
      request.onupgradeneeded = (event) => {const db = request.result; db.createObjectStore(this.#s, { keyPath: 'key' })}
      request.onsuccess = (event) => {resolve(request.result)}
      request.onerror = (event) => {reject(event)}})
  }
}

const proxyHandler = {
  get(target: any, key: string) { return target[key] || target.getItem(key); },
  set(target: any, key: string, value: any) { target.setItem(key, value); return true;},
  deleteProperty(target: any, key: any) { return target.removeItem(key); }
}

export default Vault
