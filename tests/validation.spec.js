/**
 * Tests for validation middleware
 */

import Vault from '../vault.js';
import { validationMiddleware, strictValidationMiddleware, createValidationMiddleware, ValidationError } from '../middlewares/validation.js';

describe('Validation Middleware', () => {
  let vault;

  beforeEach(() => {
    vault = new Vault('test-validation-vault');
    vault.use(validationMiddleware);
  });

  afterEach(async () => {
    await vault.clear();
  });

  describe('Key Validation', () => {
    it('should reject null key', async () => {
      await expectAsync(vault.setItem(null, 'value')).toBeRejectedWithError(ValidationError, 'Key is required');
    });

    it('should reject undefined key', async () => {
      await expectAsync(vault.setItem(undefined, 'value')).toBeRejectedWithError(ValidationError, 'Key is required');
    });

    it('should reject empty string key', async () => {
      await expectAsync(vault.setItem('', 'value')).toBeRejectedWithError(ValidationError, 'Key cannot be empty');
    });

    it('should reject non-string key', async () => {
      await expectAsync(vault.setItem(123, 'value')).toBeRejectedWithError(ValidationError, 'Key must be a string');
    });

    it('should accept valid string key', async () => {
      await expectAsync(vault.setItem('valid-key', 'value')).toBeResolved();
    });
  });

  describe('Metadata Validation', () => {
    it('should accept null metadata', async () => {
      await expectAsync(vault.setItem('key', 'value', null)).toBeResolved();
    });

    it('should accept undefined metadata', async () => {
      await expectAsync(vault.setItem('key', 'value', undefined)).toBeResolved();
    });

    it('should accept valid object metadata', async () => {
      await expectAsync(vault.setItem('key', 'value', { custom: 'data' })).toBeResolved();
    });

    it('should reject non-object metadata', async () => {
      await expectAsync(vault.setItem('key', 'value', 'string-meta')).toBeRejectedWithError(ValidationError, 'Meta must be an object or null');
    });

    it('should reject array metadata', async () => {
      await expectAsync(vault.setItem('key', 'value', ['array'])).toBeRejectedWithError(ValidationError, 'Meta cannot be an array');
    });
  });

  describe('Get Operations Validation', () => {
    it('should validate key for getItem', async () => {
      await expectAsync(vault.getItem('')).toBeRejectedWithError(ValidationError, 'Key cannot be empty');
    });

    it('should validate key for getItemMeta', async () => {
      await expectAsync(vault.getItemMeta(null)).toBeRejectedWithError(ValidationError, 'Key is required');
    });

    it('should validate key for removeItem', async () => {
      await expectAsync(vault.removeItem(123)).toBeRejectedWithError(ValidationError, 'Key must be a string');
    });
  });

  describe('Custom Validation Middleware', () => {
    it('should support custom validation functions', async () => {
      const customValidator = (context) => {
        if (context.operation === 'set' && context.key === 'forbidden') {
          throw new ValidationError('Key "forbidden" is not allowed', 'key');
        }
      };

      const customMiddleware = createValidationMiddleware({
        customValidators: [customValidator]
      });

      const customVault = new Vault('custom-validation-vault');
      customVault.use(customMiddleware);

      await expectAsync(customVault.setItem('allowed', 'value')).toBeResolved();
      await expectAsync(customVault.setItem('forbidden', 'value')).toBeRejectedWithError(ValidationError, 'Key "forbidden" is not allowed');
      
      await customVault.clear();
    });

    it('should support configurable validation options', async () => {
      const customMiddleware = createValidationMiddleware({
        validateKeys: false, // Disable key validation
        validateMeta: true,
        validateTTL: false // Disable TTL validation
      });

      const customVault = new Vault('configurable-validation-vault');
      customVault.use(customMiddleware);

      // Should allow empty key since key validation is disabled
      await expectAsync(customVault.setItem('', 'value')).toBeResolved();
      
      // Should allow invalid TTL since TTL validation is disabled
      await expectAsync(customVault.setItem('key', 'value', { ttl: 'invalid' })).toBeResolved();
      
      // Should still validate metadata structure since validateMeta is true
      await expectAsync(customVault.setItem('key', 'value', 'invalid-meta')).toBeRejectedWithError(ValidationError, 'Meta must be an object or null');
      
      await customVault.clear();
    });

    it('should support multiple custom validators', async () => {
      const keyValidator = (context) => {
        if (context.key && context.key.startsWith('admin_')) {
          throw new ValidationError('Admin keys are not allowed', 'key');
        }
      };

      const valueValidator = (context) => {
        if (context.operation === 'set' && typeof context.value === 'string' && context.value.includes('password')) {
          throw new ValidationError('Values containing "password" are not allowed', 'value');
        }
      };

      const customMiddleware = createValidationMiddleware({
        customValidators: [keyValidator, valueValidator]
      });

      const customVault = new Vault('multi-validator-vault');
      customVault.use(customMiddleware);

      await expectAsync(customVault.setItem('user_key', 'safe_value')).toBeResolved();
      await expectAsync(customVault.setItem('admin_key', 'value')).toBeRejectedWithError(ValidationError, 'Admin keys are not allowed');
      await expectAsync(customVault.setItem('user_key', 'my_password')).toBeRejectedWithError(ValidationError, 'Values containing "password" are not allowed');
      
      await customVault.clear();
    });
  });

  describe('Strict Validation Middleware', () => {
    beforeEach(() => {
      vault = new Vault('strict-validation-vault');
      vault.use(strictValidationMiddleware);
    });

    it('should reject non-serializable values', async () => {
      const circularObj = {};
      circularObj.self = circularObj;
      
      await expectAsync(vault.setItem('key', circularObj)).toBeRejectedWithError(ValidationError, 'Value must be JSON serializable');
    });

    it('should reject very long keys', async () => {
      const longKey = 'a'.repeat(251);
      await expectAsync(vault.setItem(longKey, 'value')).toBeRejectedWithError(ValidationError, 'Key length should not exceed 250 characters');
    });

    it('should accept reasonable key lengths', async () => {
      const reasonableKey = 'a'.repeat(250);
      await expectAsync(vault.setItem(reasonableKey, 'value')).toBeResolved();
    });

    it('should reject metadata with reserved fields', async () => {
      await expectAsync(vault.setItem('key', 'value', { key: 'reserved' })).toBeRejectedWithError(ValidationError, 'Meta cannot contain reserved field: key');
      await expectAsync(vault.setItem('key', 'value', { value: 'reserved' })).toBeRejectedWithError(ValidationError, 'Meta cannot contain reserved field: value');
      await expectAsync(vault.setItem('key', 'value', { _version: 1 })).toBeRejectedWithError(ValidationError, 'Meta cannot contain reserved field: _version');
    });

    it('should accept valid metadata without reserved fields', async () => {
      await expectAsync(vault.setItem('key', 'value', { custom: 'data', ttl: 1000 })).toBeResolved();
    });
  });
});