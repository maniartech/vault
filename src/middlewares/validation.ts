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
 * Basic validation middleware
 */
export const validationMiddleware: Middleware = {
  name: 'validation',
  
  before(context: MiddlewareContext): MiddlewareContext {
    // Validate key for operations that need it
    if (context.operation === 'get' || 
        context.operation === 'set' || 
        context.operation === 'remove' || 
        context.operation === 'getItemMeta') {
      
      if (!context.key || typeof context.key !== 'string') {
        throw new ValidationError('Key must be a non-empty string');
      }
    }

    // Validate metadata for set operations
    if (context.operation === 'set' && context.meta !== null && context.meta !== undefined) {
      if (typeof context.meta !== 'object' || Array.isArray(context.meta)) {
        throw new ValidationError('Meta must be an object or null');
      }
    }

    return context;
  }
};