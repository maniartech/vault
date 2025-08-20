/**
 * Tests for validation middleware
 */

import Vault from '../dist/vault.js';
import { validationMiddleware, ValidationError } from '../dist/middlewares/validation.js';

describe('Validation Middleware', () => {
  let vault;

  beforeEach(() => {
    vault = new Vault('test-validation-vault');
    vault.use(validationMiddleware()); // Basic validation with no custom validators
  });

  afterEach(async () => {
    await vault.clear();
  });

  describe('Basic Validation', () => {
    it('should reject null key', async () => {
      await expectAsync(vault.setItem(null, 'value')).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should reject undefined key', async () => {
      await expectAsync(vault.setItem(undefined, 'value')).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should reject empty string key', async () => {
      await expectAsync(vault.setItem('', 'value')).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should reject non-string key', async () => {
      await expectAsync(vault.setItem(123, 'value')).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should accept valid string key', async () => {
      await expectAsync(vault.setItem('valid-key', 'value')).toBeResolved();
    });

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
      await expectAsync(vault.setItem('key', 'value', ['array'])).toBeRejectedWithError(ValidationError, 'Meta must be an object or null');
    });

    it('should validate key for getItem', async () => {
      await expectAsync(vault.getItem('')).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should validate key for getItemMeta', async () => {
      await expectAsync(vault.getItemMeta(null)).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should validate key for removeItem', async () => {
      await expectAsync(vault.removeItem(123)).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });
  });

  describe('Custom Validation', () => {
    it('should support single custom validation function', async () => {
      const customValidator = (context) => {
        if (context.operation === 'set' && context.key === 'forbidden') {
          throw new ValidationError('Key "forbidden" is not allowed');
        }
      };

      const customVault = new Vault('custom-validation-vault');
      customVault.use(validationMiddleware(customValidator));

      await expectAsync(customVault.setItem('allowed', 'value')).toBeResolved();
      await expectAsync(customVault.setItem('forbidden', 'value')).toBeRejectedWithError(ValidationError, 'Key "forbidden" is not allowed');

      await customVault.clear();
    });

    it('should support multiple custom validators', async () => {
      const keyValidator = (context) => {
        if (context.key && context.key.startsWith('admin_')) {
          throw new ValidationError('Admin keys are not allowed');
        }
      };

      const valueValidator = (context) => {
        if (context.operation === 'set' && typeof context.value === 'string' && context.value.includes('password')) {
          throw new ValidationError('Values containing "password" are not allowed');
        }
      };

      const customVault = new Vault('multi-validator-vault');
      customVault.use(validationMiddleware(keyValidator, valueValidator));

      await expectAsync(customVault.setItem('user_key', 'safe_value')).toBeResolved();
      await expectAsync(customVault.setItem('admin_key', 'value')).toBeRejectedWithError(ValidationError, 'Admin keys are not allowed');
      await expectAsync(customVault.setItem('user_key', 'my_password')).toBeRejectedWithError(ValidationError, 'Values containing "password" are not allowed');

      await customVault.clear();
    });

    it('should run basic validation before custom validators', async () => {
      const customValidator = (context) => {
        // Only throw for set operations to avoid interfering with clear()
        if (context.operation === 'set') {
          throw new ValidationError('Custom validator should not run');
        }
      };

      const customVault = new Vault('basic-first-vault');
      customVault.use(validationMiddleware(customValidator));

      // Basic validation should fail first, so custom validator never runs
      await expectAsync(customVault.setItem('', 'value')).toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');

      await customVault.clear();
    });

    it('should support type validation example', async () => {
      const typeValidator = (ctx) => {
        if (ctx.operation === 'set') {
          const o = ctx.value;
          if (typeof o !== 'object' || !o.type) {
            throw new ValidationError('type missing!');
          }
        }
      };

      const customVault = new Vault('type-validation-vault');
      customVault.use(validationMiddleware(typeValidator));

      await expectAsync(customVault.setItem('key', { type: 'user', name: 'John' })).toBeResolved();
      await expectAsync(customVault.setItem('key', { name: 'John' })).toBeRejectedWithError(ValidationError, 'type missing!');
      await expectAsync(customVault.setItem('key', 'string-value')).toBeRejectedWithError(ValidationError, 'type missing!');

      await customVault.clear();
    });
  });
});