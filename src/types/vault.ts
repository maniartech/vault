/**
 * Core interfaces and types for the Vault Storage system
 */

/**
 * Metadata that can be associated with vault items
 * This is a generic record that middleware can extend as needed
 */
export type VaultItemMeta = Record<string, any>;

/**
 * Complete vault item structure including metadata
 */
export interface VaultItem<T = any> {
  /** The unique key identifier for the item */
  key: string;
  /** The stored value */
  value: T;
  /** Associated metadata or null if none */
  meta: VaultItemMeta | null;
}

/**
 * Core storage interface that all vault implementations must follow
 */
export interface VaultStorage {
  /** Get all keys stored in the vault */
  keys(): Promise<string[]>;
  
  /** Retrieve an item by key, returns null if not found or expired */
  getItem<T = any>(key: string): Promise<T | null>;
  
  /** Get metadata for an item by key, returns null if not found */
  getItemMeta(key: string): Promise<VaultItemMeta | null>;
  
  /** Store an item with optional metadata */
  setItem<T = any>(key: string, value: T, meta?: VaultItemMeta | null): Promise<void>;
  
  /** Remove an item by key */
  removeItem(key: string): Promise<void>;
  
  /** Clear all items from the vault */
  clear(): Promise<void>;
  
  /** Get the total number of items in the vault */
  length(): Promise<number>;
}

/**
 * Configuration options for vault instances
 */
export interface VaultOptions {
  /** Name of the storage database */
  storageName?: string;
}

/**
 * Internal storage structure for vault items in IndexedDB
 */
export interface StoredVaultItem {
  /** The unique key identifier */
  key: string;
  /** The stored value */
  value: any;
  /** Associated metadata or null */
  meta: VaultItemMeta | null;
}