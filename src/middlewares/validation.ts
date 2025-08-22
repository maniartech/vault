/**
 * Simple validation middleware for Vault Storage
 */

import { Middleware, MiddlewareContext } from '../types/middleware.js';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom validation function type
 */
export type CustomValidator = (context: MiddlewareContext) => void | Promise<void>;

/**
 * Creates validation middleware with custom validators
 */
function validationMiddleware(...validators: CustomValidator[]): Middleware {
  return {
    name: 'validation',

    async before(context: MiddlewareContext): Promise<MiddlewareContext> {
      // Basic validation first
      if (context.operation === 'get' ||
          context.operation === 'set' ||
          context.operation === 'remove' ||
          context.operation === 'getItemMeta') {

        // Key must be a string with at least one non-whitespace character
        if (typeof context.key !== 'string' || context.key.trim().length === 0) {
          throw new ValidationError('Key must be a non-empty string');
        }
      }

      // Validate metadata for set operations
      if (context.operation === 'set' && context.meta !== null && context.meta !== undefined) {
        if (typeof context.meta !== 'object' || Array.isArray(context.meta)) {
          throw new ValidationError('Meta must be an object or null');
        }
      }

      // Run custom validators for all operations
      // Validators can internally decide which operations to act on
      // (e.g., if (context.operation === 'set') { ... }).
      for (const validator of validators) {
        await validator(context);
      }

      return context;
    }
  };
}

export default validationMiddleware;

// Also export as named export for backward compatibility
export { validationMiddleware };