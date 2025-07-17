/**
 * Cryptography-related types for SecuredVault
 */

/**
 * Encryption credential containing password and salt
 */
export interface EncryptionCredential {
  /** The password used for key derivation */
  readonly password: string;
  /** The salt used for key derivation */
  readonly salt: string;
}

/**
 * Function type that provides encryption credentials based on a key
 */
export type EncryptionCredentialProvider = (key: string) => Promise<EncryptionCredential>;

/**
 * Configuration for encryption that can be a credential object,
 * a function that provides credentials, or null for no encryption
 */
export type EncryptionConfig = 
  | EncryptionCredential 
  | EncryptionCredentialProvider
  | null;

/**
 * Result of cryptographic operations containing encrypted data and IV
 */
export interface CryptoResult {
  /** The encrypted/decrypted data */
  data: ArrayBuffer;
  /** The initialization vector used for encryption */
  iv: Uint8Array;
}

/**
 * Configuration options specific to SecuredVault
 */
export interface SecuredVaultOptions {
  /** Name of the storage database */
  storageName?: string;
  /** Encryption configuration */
  encryptionConfig: EncryptionConfig;
  /** Number of iterations for key derivation (default: 100000) */
  keyDerivationIterations?: number;
  /** Whether to enable automatic expiration handling */
  enableExpiration?: boolean;
  /** Interval in milliseconds for automatic cleanup of expired items */
  cleanupInterval?: number;
  /** Maximum number of keys to cache (default: 100) */
  maxCachedKeys?: number;
}

/**
 * Cryptographic algorithm configurations
 */
export interface CryptoAlgorithmConfig {
  /** Salt length in bytes */
  readonly SALT_LENGTH: number;
  /** Initialization vector length in bytes */
  readonly IV_LENGTH: number;
  /** Default key derivation iterations */
  readonly KEY_DERIVATION_ITERATIONS: number;
  /** Hash algorithm for key derivation */
  readonly HASH_ALGORITHM: string;
  /** Encryption algorithm */
  readonly ENCRYPTION_ALGORITHM: string;
  /** Key length in bits */
  readonly KEY_LENGTH: number;
}

/**
 * Key cache entry for managing cached cryptographic keys
 */
export interface KeyCacheEntry {
  /** The cached cryptographic key */
  key: CryptoKey;
  /** Timestamp when the key was cached */
  cachedAt: number;
  /** Number of times this key has been accessed */
  accessCount: number;
}