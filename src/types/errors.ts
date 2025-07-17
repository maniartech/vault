/**
 * Error types and interfaces for the Vault Storage system
 */

/**
 * Base error class for all vault-related errors
 */
export interface VaultErrorInfo {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional underlying cause of the error */
  cause?: Error;
  /** Additional context information */
  context?: Record<string, any>;
}

/**
 * Error codes used throughout the vault system
 */
export enum VaultErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  
  // Initialization errors
  INIT_ERROR = 'INIT_ERROR',
  DB_UNAVAILABLE = 'DB_UNAVAILABLE',
  
  // Operation errors
  OPERATION_ERROR = 'OPERATION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  
  // Validation errors
  INVALID_KEY = 'INVALID_KEY',
  INVALID_VALUE = 'INVALID_VALUE',
  INVALID_META = 'INVALID_META',
  INVALID_EXPIRES = 'INVALID_EXPIRES',
  INVALID_TTL = 'INVALID_TTL',
  
  // Cryptography errors
  CRYPTO_ERROR = 'CRYPTO_ERROR',
  KEY_DERIVATION_ERROR = 'KEY_DERIVATION_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  INVALID_CREDENTIAL = 'INVALID_CREDENTIAL',
  
  // Storage errors
  STORAGE_FULL = 'STORAGE_FULL',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Expiration errors
  ITEM_EXPIRED = 'ITEM_EXPIRED',
  CLEANUP_ERROR = 'CLEANUP_ERROR'
}

/**
 * Type guard to check if an error is a vault error
 */
export interface VaultErrorLike {
  name: string;
  message: string;
  code: string;
  cause?: Error;
}