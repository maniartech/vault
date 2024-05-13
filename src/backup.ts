interface Vault {
  getAllKeys(): Promise<string[]>;
  get(key: string): Promise<any>;
  getMetadata(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  setMetadata(key: string, metadata: any): Promise<void>;
}

/**
 * Exports the data from the given vault to a JSON string.
 *
 * This function retrieves all keys from the vault, and for each key,
 * it retrieves the associated value and metadata. It then constructs
 * an array of objects, each containing a key, value, and metadata,
 * and converts this array to a JSON string.
 *
 * @param vault - The vault from which to export data.
 * @returns A promise that resolves to a JSON string representing the data in the vault.
 */
export async function exportData(vault: Vault): Promise<string> {
    const data = [];

    for (const key of await vault.getAllKeys()) {
        const value = await vault.get(key);
        const metadata = await vault.getMetadata(key);
        data.push({ key, value, metadata });
    }

    return JSON.stringify(data);
}

/**
 * Imports data into the given vault from a JSON string.
 *
 * This function parses the input JSON string into an array of objects,
 * and for each object, it sets the value and metadata for the given key in the vault.
 *
 * @param vault - The vault into which to import data.
 * @param jsonString - The JSON string from which to import data.
 * @returns A promise that resolves when the data has been imported.
 */
export async function importData(vault: Vault, jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);

    for (const item of data) {
        await vault.set(item.key, item.value);
        await vault.setMetadata(item.key, item.metadata);
    }
}