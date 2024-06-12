interface Vault {
  keys(): Promise<string[]>;
  getItem(key: string): Promise<any>;
  getItemMeta(key: string): Promise<any>;
  setItem(key: string, value: any, meta:Record<string, any> | null): Promise<void>;
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
export async function exportData(vault: Vault): Promise<Record<string, any>> {
    const data: Record<string, any> = {}

    for (const key of await vault.keys()) {
        const value = await vault.getItem(key);
        const meta = await vault.getItemMeta(key);
        data[key] = { value, meta };
    }

    return data;
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
export async function importData(vault: Vault, data: Record<string, any>): Promise<void> {
  for (const key of Object.keys(data)) {
      const { value, meta } = data[key];
      await vault.setItem(key, value, meta ?? null);
  }
}