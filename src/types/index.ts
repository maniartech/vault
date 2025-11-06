/**
 * Centralized type exports for the Vault Storage system
 *
 * This module provides a single entry point for all type definitions
 * used throughout the vault system, ensuring consistent typing and
 * easy imports for consumers.
 */

// Core vault types
export type {
  VaultItemMeta,
  VaultItem,
  VaultStorage,
  VaultOptions,
  StoredVaultItem
} from './vault.js';

// Middleware types
export type {
  MiddlewareContext,
  Middleware
} from './middleware.js';

// Error types
export type {
  VaultErrorInfo,
  VaultErrorLike
} from './errors.js';

export {
  VaultErrorCode
} from './errors.js';

// Crypto types (for EncryptedVault)
export type {
  EncryptionCredential,
  EncryptionCredentialProvider,
  EncryptionConfig,
  CryptoResult,
  CryptoAlgorithmConfig,
  KeyCacheEntry
} from './crypto.js';

