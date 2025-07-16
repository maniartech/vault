/**
 * Validation middleware for Vault Storage
 * Provides input validation for keys, values, and metadata
 */

import { Middleware, MiddlewareContext } from '../types/middleware.js';

/**
 * Validation error class for more specific error handling
 */
export class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom validation function type
 */
export type CustomValidator = (context: MiddlewareContext) => void | Promise<void>;

/**
 * Validation configuration options
 */
export interface ValidationConfig {
  /** Enable/disable key validation */
  validateKeys?: boolean;
  /** Enable/disable metadata validation */
  validateMeta?: boolean;
  /** Enable/disable TTL validation */
  validateTTL?: boolean;
  /** Enable/disable expiration validation */
  validateExpires?: boolean;
  /** Enable/disable strict validation (serialization, key length, reserved fields) */
  strict?: boolean;
  /** Maximum allowed key length (default: 250) */
  maxKeyLength?: number;
  /** Custom validation functions */
  customValidators?: CustomValidator[];
  /** Reserved metadata field names */
  reservedFields?: string[];
}

/**
 * Validation functions for common patterns
 */
export const validators = {
  /**
   * Validates that a key is a non-empty string
   */
  key(key: any): void {
    if (key === undefined || key === null) {
      throw new ValidationError('Key is required', 'key');
    }
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', 'key');
    }
    if (key.length === 0) {
      throw new ValidationError('Key cannot be empty', 'key');
    }
    if (key.trim() !== key) {
      throw new ValidationError('Key cannot have leading or trailing whitespace', 'key');
    }
  },

  /**
   * Validates metadata object
   */
  meta(meta: any): void {
    if (meta === null || meta === undefined) {
      return; // null/undefined meta is allowed
    }
    if (typeof meta !== 'object') {
      throw new ValidationError('Meta must be an object or null', 'meta');
    }
    if (Array.isArray(meta)) {
      throw new ValidationError('Meta cannot be an array', 'meta');
    }
  },

  /**
   * Validates TTL value if present in metadata
   */
  ttl(meta: any): void {
    if (meta && typeof meta === 'object' && 'ttl' in meta) {
      const ttl = meta.ttl;
      if (typeof ttl !== 'number') {
        throw new ValidationError('TTL must be a number', 'meta.ttl');
      }
      if (ttl <= 0) {
        throw new ValidationError('TTL must be greater than 0', 'meta.ttl');
      }
      if (!Number.isInteger(ttl)) {
        throw new ValidationError('TTL must be an integer', 'meta.ttl');
      }
    }
  },

  /**
   * Validates expiration timestamp if present in metadata
   */
  expires(meta: any): void {
    if (meta && typeof meta === 'object' && 'expires' in meta) {
      const expires = meta.expires;
      if (typeof expires !== 'number') {
        throw new ValidationError('Expires must be a number', 'meta.expires');
      }
      if (expires <= 0) {
        throw new ValidationError('Expires must be greater than 0', 'meta.expires');
      }
      if (!Number.isInteger(expires)) {
        throw new ValidationError('Expires must be an integer', 'meta.expires');
      }
    }
  }
};

/**
 * Basic validation middleware that validates keys and metadata
 */
export const validationMiddleware: Middleware = {
  name: 'validation',
  
  before(context: MiddlewareContext): MiddlewareContext {
    // Validate key for operations that require it
    if (context.operation === 'get' || 
        context.operation === 'set' || 
        context.operation === 'remove' || 
        context.operation === 'getItemMeta') {
      validators.key(context.key);
    }

    // Validate metadata for set operations
    if (context.operation === 'set') {
      validators.meta(context.meta);
      validators.ttl(context.meta);
      validators.expires(context.meta);
    }

    return context;
  }
};

/**
 * Creates a configurable validation middleware with custom validation support
 */
export function createValidationMiddleware(config: ValidationConfig = {}): Middleware {
  const {
    validateKeys = true,
    validateMeta = true,
    validateTTL = true,
    validateExpires = true,
    strict = false,
    maxKeyLength = 250,
    customValidators = [],
    reservedFields = ['key', 'value', '_version', '_checksum']
  } = config;

  return {
    name: 'configurable-validation',
    
    async before(context: MiddlewareContext): Promise<MiddlewareContext> {
      // Basic key validation
      if (validateKeys && (context.operation === 'get' || 
          context.operation === 'set' || 
          context.operation === 'remove' || 
          context.operation === 'getItemMeta')) {
        validators.key(context.key);
      }

      // Metadata validation for set operations
      if (context.operation === 'set') {
        if (validateMeta) {
          validators.meta(context.meta);
        }
        
        if (validateTTL) {
          validators.ttl(context.meta);
        }
        
        if (validateExpires) {
          validators.expires(context.meta);
        }

        // Strict validations
        if (strict) {
          // Validate value is serializable
          try {
            JSON.stringify(context.value);
          } catch (error) {
            throw new ValidationError('Value must be JSON serializable', 'value');
          }

          // Check for reasonable key length (only if key validation is enabled or key is provided)
          if (context.key && context.key.length > maxKeyLength) {
            throw new ValidationError(`Key length should not exceed ${maxKeyLength} characters`, 'key');
          }

          // Validate metadata doesn't contain reserved fields
          if (context.meta && typeof context.meta === 'object') {
            for (const field of reservedFields) {
              if (field in context.meta) {
                throw new ValidationError(`Meta cannot contain reserved field: ${field}`, 'meta');
              }
            }
          }
        }
      }

      // Run custom validators
      for (const customValidator of customValidators) {
        await customValidator(context);
      }

      return context;
    }
  };
}

/**
 * Strict validation middleware with additional checks
 */
export const strictValidationMiddleware: Middleware = {
  name: 'strict-validation',
  
  before(context: MiddlewareContext): MiddlewareContext {
    // Run basic validation first
    validationMiddleware.before!(context);

    // Additional strict validations
    if (context.operation === 'set') {
      // Validate value is serializable
      try {
        JSON.stringify(context.value);
      } catch (error) {
        throw new ValidationError('Value must be JSON serializable', 'value');
      }

      // Check for reasonable key length
      if (context.key && context.key.length > 250) {
        throw new ValidationError('Key length should not exceed 250 characters', 'key');
      }

      // Validate metadata doesn't contain reserved fields
      if (context.meta && typeof context.meta === 'object') {
        const reservedFields = ['key', 'value', '_version', '_checksum'];
        for (const field of reservedFields) {
          if (field in context.meta) {
            throw new ValidationError(`Meta cannot contain reserved field: ${field}`, 'meta');
          }
        }
      }
    }

    return context;
  }
};