const rw = 'readwrite'
const r = 'readonly'

class Vault {
  #d = null as IDBDatabase | null;
  #s = 'vault';

  constructor(dbName:string = location.host, storeName:string = 'vault') {
    this.#s = storeName || 'vault';
    this.#init(dbName).then(db => this.#d = db);
  }

  async setItem(key: string, value: any): Promise<void> {
    return this.#$(rw, store => store.put({ key, value }));
  }

  async getItem(key: string): Promise<any> {
    return this.#$(r, store => store.get(key))
        .then(result => result ? result.value : null);
  }

  async removeItem(key: string): Promise<void> {
    return this.#$(rw, store => store.delete(key));
  }

  async clear(): Promise<void> {
    return this.#$(rw, store => store.clear());
  }

  async length(): Promise<number> {
    return this.#$(r, store => store.count());
  }
  async #$(
    operationType: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<any> {
    // this.#d = this.#d || await this.#init(location.host, this.#s); // Function to initialize the default database

    return new Promise((resolve, reject) => {
      const request = operation(
        this.#d!.transaction(this.#s, operationType) // transaction
        .objectStore(this.#s) // store
      );

      request.onsuccess = () => resolve(operationType === r ? request.result : void 0)
      request.onerror = (event) => reject(event);
    });
  }

  async #init(dbName:string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        db.createObjectStore(this.#s, { keyPath: 'key' }); // "vault" is an example store name
      };

      request.onsuccess = (event) => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(event);
      };
    });
  }
}
