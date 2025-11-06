import Vault from './vault.js';
import EncryptedVault from './encrypted-vault.js';

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
  CryptoAlgorithmConfig,
  KeyCacheEntry
} from './types/index.js';

// Note: no runtime enums re-exported here to keep index minimal.

// Keep named exports for compatibility; bundlers can tree-shake if unused
export { default as Vault } from './vault.js';
export { default as EncryptedVault } from './encrypted-vault.js';

/**
 * Default vault singleton for quick use.
 */
const vault = new Vault();

export default vault;
