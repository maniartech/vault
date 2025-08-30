/**
 * Middleware exports for Vault Storage
 */

// Import default exports from individual middleware files
import validationMiddleware from './validation.js';
import { expirationMiddleware } from './expiration.js';
import encryptionMiddleware from './encryption.js';

// Re-export for named imports (backwards compatibility)
export { validationMiddleware, expirationMiddleware, encryptionMiddleware };

// Re-export error classes and types
export { ValidationError, type CustomValidator } from './validation.js';
export { type ExpirationOptions } from './expiration.js';
export { EncryptionError, type EncryptionOptions } from './encryption.js';