// Types for the keys and values stored in the vault
type VaultKey = string;
type VaultValue = any; // Replace 'any' with a more specific type if applicable

/**
 * Interface for the vault storage.
 * Provides methods to interact with IndexedDB using a simple key-value interface.
 */
export interface IVault {

  /**
   * Sets a value in the store.
   * @param key - The key under which the value will be stored.
   * @param value - The value to be stored.
   * @returns A promise that resolves when the operation is complete.
   */
  setItem(key: VaultKey, value: VaultValue): Promise<void>;

  /**
   * Retrieves a value from the store.
   * @param key - The key of the value to retrieve.
   * @returns A promise that resolves with the retrieved value.
   */
  getItem(key: VaultKey): Promise<VaultValue>;

  /**
   * Removes an item from the store.
   * @param key - The key of the item to remove.
   * @returns A promise that resolves when the operation is complete.
   */
  removeItem(key: VaultKey): Promise<void>;

  /**
   * Clears all entries in the store.
   * @returns A promise that resolves when the operation is complete.
   */
  clear(): Promise<void>;

  /**
   * Retrieves the number of entries in the store.
   * @returns A promise that resolves with the count of entries.
   */
  length(): Promise<number>;


  // Keys and values can also be accessed directly on the vault object
  [key: VaultKey]: VaultValue;
}

// Declaration of the vault object implementing the IVault interface
declare const vault: IVault;
export default vault;
