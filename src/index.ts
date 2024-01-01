// Constants for read and write operations
const RW = 'readwrite'
const R = 'readonly'

// The database instance
let db = null as IDBDatabase | null
// The name of the store within the database
const storeName = "vault"

/**
 * The vault, an object provides an easy to
 */
const vault = new Proxy({
  /**
   * Sets a value in the store.
   * @param {string} key - The key to set.
   * @param {any} value - The value to set.
   * @returns {Promise<void>}
   */
  async setItem(key: string, value: any): Promise<void> {
    return $(RW, store => store.put({ key, value }));
  },


  /**
   * Get a value from the store.
   * @param {string} key - The key to get.
   * @returns {Promise<any>} - The value associated with the key, or null if not found.
   */
  async getItem(key: string): Promise<any> {
    return $(R, store => store.get(key))
        .then(result => result ? result.value : null);
  },

  /**
   * Remove a key-value pair from the store.
   * @param {string} key - The key to remove.
   * @returns {Promise<void>}
   */
  async removeItem(key: string): Promise<void> {
    return $(RW, store => store.delete(key));
  },

  /**
   * Clear all key-value pairs from the store.
   * @returns {Promise<void>}
   */
  async clear(): Promise<void> {
    return $(RW, store => store.clear());
  },

  /**
   * Get the number of key-value pairs in the store.
   * @returns {Promise<number>} - The number of key-value pairs in the store.
   */
  async length(): Promise<number> {
    return $(R, store => store.count());
  }
}, {
  /**
   * Proxy get handler.
   * If the property exists on the target, return it.
   * Otherwise, get the value from the store.
   */
  get(target: any, key: string) {
    return target[key] || target.getItem(key);
  },

  /**
   * Proxy set handler.
   * If the property exists on the target, set it.
   * Otherwise, set the value in the store.
   */
  set(target: any, key: string, value: any) {
    target.setItem(key, value);
    return true; // Return true immediately, indicating the set was "handled"
  },

  /**
   * Proxy deleteProperty handler.
   * Deletes the value from the store.
   */
  deleteProperty(target, key) {
    return target.removeItem(key);
  }
});

/**
 * Perform a database operation.
 * @param {typeof vault} v - The vault instance.
 * @param {string} operationType - The type of operation (read or write).
 * @param {(store: IDBObjectStore) => IDBRequest} operation - The operation to perform.
 * @returns {Promise<any>} - The result of the operation.
 */
async function $(
  operationType: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest
): Promise<any> {
  db = db || await initDB(location.host, storeName); // Function to initialize the default database

  return new Promise((resolve, reject) => {
    const request = operation(
      db!.transaction(storeName, operationType) // transaction
      .objectStore(storeName) // store
    );

    request.onsuccess = () => resolve(operationType === R ? request.result : void 0)
    request.onerror = (event) => reject(event);
  });
}

/**
 * Initialize the default database.
 * @param {string} dbName - The name of the database.
 * @param {string} storeName - The name of the store within the database.
 * @returns {Promise<IDBDatabase>} - The initialized database.
 */
async function initDB(dbName:string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      db.createObjectStore(storeName, { keyPath: 'key' }); // "vault" is an example store name
    };

    request.onsuccess = (event) => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      reject(event);
    };
  });
}

// Export the vault object
export default vault