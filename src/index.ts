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
  EncryptionCredential,
  EncryptionCredentialProvider,
  EncryptionConfig,
  VaultErrorInfo,
  VaultErrorLike,
  VaultKey,
  VaultValue,
  VaultMetadata,
  PartialExcept,
  ExtractVaultValue,
  CreateVaultItem,
  VaultOperationResult
} from './types/index.js';

// Export error codes enum
export { VaultErrorCode } from './types/index.js';

// Export classes for direct instantiation
export { default as Vault } from './vault.js';
export { default as SecuredVault } from './secured-vault.js';

// Export utility functions
export { exportData, importData } from './backup.js';

/**
 * The default vault storage instance that provides a convenient way to use the
 * Vault without having to instantiate it manually. This instance is created
 * by default when the module is imported.
 *
 * @type {Vault}
 */
const vault = new Vault();

export default vault;
