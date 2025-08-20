import Vault from './vault.js';

// Export all types for TypeScript consumers
export type {
  VaultItemMeta,
  VaultItem,
  VaultStorage,
  VaultOptions,
  StoredVaultItem,
  MiddlewareContext,
  Middleware,
  VaultErrorInfo,
  VaultErrorLike,
  EncryptionCredential,
  EncryptionCredentialProvider,
  EncryptionConfig,
  CryptoResult,
  SecuredVaultOptions,
  CryptoAlgorithmConfig,
  KeyCacheEntry
} from './types/index.js';

// Export error codes enum
export { VaultErrorCode } from './types/index.js';

// Export classes for direct instantiation
export { default as Vault } from './vault.js';
export { default as EncryptedVault } from './encrypted-vault.js';

// Export utility functions
export { exportData, importData } from './backup.js';

// Export middleware functions
export { encryptionMiddleware, EncryptionError } from './middlewares/encryption.js';
export { expirationMiddleware } from './middlewares/expiration.js';
export { validationMiddleware } from './middlewares/validation.js';

/**
 * The default vault storage instance that provides a convenient way to use the
 * Vault without having to instantiate it manually. This instance is created
 * by default when the module is imported.
 *
 * @type {Vault}
 */
const vault = new Vault();

export default vault;
