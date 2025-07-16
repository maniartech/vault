/**
 * Middleware exports for Vault Storage
 */

export { 
  validationMiddleware,
  ValidationError,
  type CustomValidator
} from './validation.js';

export {
  expirationMiddleware,
  type ExpirationOptions
} from './expiration.js';