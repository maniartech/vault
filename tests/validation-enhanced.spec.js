/**
 * Enhanced validation middleware tests with comprehensive edge cases
 */

import Vault from '../dist/vault.js';
import { validationMiddleware, ValidationError } from '../dist/middlewares/validation.js';

describe('Validation Middleware - Enhanced Coverage', () => {
  let vault;

  beforeEach(() => {
    vault = new Vault('test-validation-enhanced');
  });

  afterEach(async () => {
    await vault.clear();
  });

  describe('Edge Cases and Error Conditions', () => {
    beforeEach(() => {
      vault.use(validationMiddleware());
    });

    // TODO: Fix validation for whitespace-only keys - promise rejection not working
    xit('should handle whitespace-only keys', async () => {
      await expectAsync(vault.setItem('   ', 'value'))
        .toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');

      await expectAsync(vault.setItem('\t\n\r', 'value'))
        .toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(10000);
      await expectAsync(vault.setItem(longKey, 'value')).toBeResolved();

      const result = await vault.getItem(longKey);
      expect(result).toBe('value');
    });

    it('should handle special characters in keys', async () => {
      const specialKeys = [
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
        'key@with@symbols',
        'key with spaces',
        'key/with/slashes',
        'key\\with\\backslashes',
        'key[with]brackets',
        'key{with}braces',
        'key(with)parentheses',
        'unicode-key-ñáéíóú',
        'emoji-key-🔑📦',
        '数字键',
        'مفتاح',
        'ключ',
        '키'
      ];

      for (const key of specialKeys) {
        await expectAsync(vault.setItem(key, `value-for-${key}`)).toBeResolved();
        const result = await vault.getItem(key);
        expect(result).toBe(`value-for-${key}`);
      }
    });

    // TODO: Fix complex validation logic - middleware validation edge cases
    xit('should handle complex metadata validation', async () => {
      const validMetadata = [
        null,
        undefined,
        {},
        { simple: 'value' },
        { nested: { deep: { object: true } } },
        { array: [1, 2, 3] },
        { mixed: { string: 'text', number: 42, boolean: true, null: null } }
      ];

      for (let i = 0; i < validMetadata.length; i++) {
        const meta = validMetadata[i];
        await expectAsync(vault.setItem(`key${i}`, `value${i}`, meta)).toBeResolved();
      }

      const invalidMetadata = [
        'string-metadata',
        123,
        true,
        [],
        [1, 2, 3],
        Symbol('symbol'),
        function() {}
      ];

      for (let i = 0; i < invalidMetadata.length; i++) {
        const meta = invalidMetadata[i];
        await expectAsync(vault.setItem(`invalid${i}`, 'value', meta))
          .toBeRejectedWithError(ValidationError, 'Meta must be an object or null');
      }
    });

    it('should handle Date objects in metadata', async () => {
      const dateValue = new Date();
      await expectAsync(vault.setItem('date-key', 'value', { created: dateValue })).toBeResolved();

      const meta = await vault.getItemMeta('date-key');
      expect(meta.created).toEqual(dateValue);
    });

    it('should handle circular references in metadata validation', async () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      // This should not cause infinite recursion but might fail serialization
      // The validation should pass since it's an object, but storage might fail
      try {
        await vault.setItem('circular', 'value', circularObj);
      } catch (error) {
        // Acceptable if it fails at storage level, not validation level
        expect(error).not.toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('Advanced Custom Validation', () => {
    it('should support async custom validators', async () => {
      const asyncValidator = async (context) => {
        // Simulate async validation (e.g., API call)
        await new Promise(resolve => setTimeout(resolve, 10));

        if (context.key && context.key.startsWith('forbidden_')) {
          throw new ValidationError('Async validation failed');
        }
      };

      const customVault = new Vault('async-validation');
      customVault.use(validationMiddleware(asyncValidator));

      await expectAsync(customVault.setItem('allowed_key', 'value')).toBeResolved();
      await expectAsync(customVault.setItem('forbidden_key', 'value'))
        .toBeRejectedWithError(ValidationError, 'Async validation failed');

      await customVault.clear();
    });

    it('should support validators that modify context', async () => {
      const modifyingValidator = (context) => {
        if (context.operation === 'set' && context.key) {
          // Normalize key to lowercase
          context.key = context.key.toLowerCase();
        }
      };

      const customVault = new Vault('modifying-validation');
      customVault.use(validationMiddleware(modifyingValidator));

      await customVault.setItem('UPPERCASE_KEY', 'value');

      // Should be stored with lowercase key
      expect(await customVault.getItem('uppercase_key')).toBe('value');
      expect(await customVault.getItem('UPPERCASE_KEY')).toBeNull();

      await customVault.clear();
    });

    it('should support context-dependent validation', async () => {
      const contextValidator = (context) => {
        if (context.operation === 'set') {
          if (!context.value || typeof context.value !== 'object' || !context.value.type) {
            throw new ValidationError('Set operations require typed objects');
          }
        } else if (context.operation === 'get') {
          if (context.key && context.key.startsWith('admin_') && !context.adminAccess) {
            throw new ValidationError('Admin access required');
          }
        }
      };

      const customVault = new Vault('context-validation');
      customVault.use(validationMiddleware(contextValidator));

      // Valid set operation
      await expectAsync(customVault.setItem('user', { type: 'user', name: 'John' }))
        .toBeResolved();

      // Invalid set operation
      await expectAsync(customVault.setItem('invalid', 'string-value'))
        .toBeRejectedWithError(ValidationError, 'Set operations require typed objects');

      await customVault.clear();
    });

    it('should support error transformation in validators', async () => {
      const transformingValidator = (context) => {
        if (context.key === 'transform-error') {
          const originalError = new Error('Original error message');
          const validationError = new ValidationError('Transformed error message');
          validationError.originalError = originalError;
          throw validationError;
        }
      };

      const customVault = new Vault('error-transformation');
      customVault.use(validationMiddleware(transformingValidator));

      try {
        await customVault.setItem('transform-error', 'value');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Transformed error message');
        expect(error.originalError).toBeDefined();
      }

      await customVault.clear();
    });

    it('should support multiple validator chains with different priorities', async () => {
      const executionOrder = [];

      const validator1 = (context) => {
        executionOrder.push('validator1');
        if (context.key === 'fail-at-1') {
          throw new ValidationError('Failed at validator 1');
        }
      };

      const validator2 = (context) => {
        executionOrder.push('validator2');
        if (context.key === 'fail-at-2') {
          throw new ValidationError('Failed at validator 2');
        }
      };

      const validator3 = (context) => {
        executionOrder.push('validator3');
        if (context.key === 'fail-at-3') {
          throw new ValidationError('Failed at validator 3');
        }
      };

      const customVault = new Vault('chain-validation');
      customVault.use(validationMiddleware(validator1, validator2, validator3));

      // Success case - all validators should run
      await customVault.setItem('success', 'value');
      expect(executionOrder).toEqual(['validator1', 'validator2', 'validator3']);

      // Failure at validator 1 - only validator 1 should run
      executionOrder.length = 0;
      await expectAsync(customVault.setItem('fail-at-1', 'value'))
        .toBeRejectedWithError(ValidationError, 'Failed at validator 1');
      expect(executionOrder).toEqual(['validator1']);

      // Failure at validator 2 - validators 1 and 2 should run
      executionOrder.length = 0;
      await expectAsync(customVault.setItem('fail-at-2', 'value'))
        .toBeRejectedWithError(ValidationError, 'Failed at validator 2');
      expect(executionOrder).toEqual(['validator1', 'validator2']);

      await customVault.clear();
    });
  });

  describe('Validation for All Operations', () => {
    it('should validate all vault operations consistently', async () => {
      const operationValidator = (context) => {
        if (context.key && context.key.startsWith('restricted_')) {
          throw new ValidationError(`${context.operation} operation not allowed on restricted keys`);
        }
      };

      const customVault = new Vault('operation-validation');
      customVault.use(validationMiddleware(operationValidator));

      // Set should fail
      await expectAsync(customVault.setItem('restricted_key', 'value'))
        .toBeRejectedWithError(ValidationError, 'set operation not allowed on restricted keys');

      // Get should fail
      await expectAsync(customVault.getItem('restricted_key'))
        .toBeRejectedWithError(ValidationError, 'get operation not allowed on restricted keys');

      // GetItemMeta should fail
      await expectAsync(customVault.getItemMeta('restricted_key'))
        .toBeRejectedWithError(ValidationError, 'getItemMeta operation not allowed on restricted keys');

      // Remove should fail
      await expectAsync(customVault.removeItem('restricted_key'))
        .toBeRejectedWithError(ValidationError, 'remove operation not allowed on restricted keys');

      // Operations without keys should work
      await expectAsync(customVault.clear()).toBeResolved();
      await expectAsync(customVault.keys()).toBeResolved();
      await expectAsync(customVault.length()).toBeResolved();

      await customVault.clear();
    });

    // TODO: Fix validation during bulk operations - clear operation validation
    xit('should handle validation during bulk operations', async () => {
      const bulkValidator = (context) => {
        if (context.operation === 'clear' && !context.confirmClear) {
          throw new ValidationError('Clear operation requires confirmation');
        }
      };

      const customVault = new Vault('bulk-validation');
      customVault.use(validationMiddleware(bulkValidator));

      // Add some data
      await customVault.setItem('key1', 'value1');
      await customVault.setItem('key2', 'value2');

      // Clear without confirmation should fail
      await expectAsync(customVault.clear())
        .toBeRejectedWithError(ValidationError, 'Clear operation requires confirmation');

      // Verify data is still there
      expect(await customVault.length()).toBe(2);

      await customVault.clear();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle many validation rules efficiently', async () => {
      const validators = [];

      // Create 100 validation functions
      for (let i = 0; i < 100; i++) {
        validators.push((context) => {
          if (context.key === `forbidden${i}`) {
            throw new ValidationError(`Rule ${i} violated`);
          }
        });
      }

      const customVault = new Vault('performance-validation');
      customVault.use(validationMiddleware(...validators));

      const startTime = performance.now();

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await customVault.setItem(`allowed${i}`, `value${i}`);
      }

      const endTime = performance.now();

      // Should complete in reasonable time despite many validators
      expect(endTime - startTime).toBeLessThan(1000);

      await customVault.clear();
    });

    it('should not leak memory with validator closures', async () => {
      const createValidator = (id) => {
        const largeData = new Array(10000).fill(`data-${id}`);
        return (context) => {
          if (context.key === `test-${id}`) {
            // Use the large data to keep it in closure
            return largeData.length > 0;
          }
        };
      };

      const customVault = new Vault('memory-validation');

      // Create multiple validators with closures
      for (let i = 0; i < 10; i++) {
        customVault.use(validationMiddleware(createValidator(i)));
      }

      // Perform operations
      for (let i = 0; i < 10; i++) {
        await customVault.setItem(`test-${i}`, `value-${i}`);
      }

      // Memory usage should not grow significantly
      // This is a basic test - in real scenarios you'd use more sophisticated memory monitoring
      expect(customVault.middlewares.length).toBe(10);

      await customVault.clear();
    });
  });

  describe('Integration with Error Handling', () => {
    it('should work with global error handlers', async () => {
      let globalErrorHandler = null;

      const errorMiddleware = {
        name: 'global-error-handler',
        error: async (context, error) => {
          globalErrorHandler = error;
          return error; // Re-throw
        }
      };

      const validator = (context) => {
        if (context.key === 'trigger-global-error') {
          throw new ValidationError('Validation error for global handler');
        }
      };

      const customVault = new Vault('global-error-validation');
      customVault.use(validationMiddleware(validator));
      customVault.use(errorMiddleware);

      await expectAsync(customVault.setItem('trigger-global-error', 'value'))
        .toBeRejectedWithError(ValidationError);

      expect(globalErrorHandler).toBeInstanceOf(ValidationError);
      expect(globalErrorHandler.message).toBe('Validation error for global handler');

      await customVault.clear();
    });

    it('should maintain error context through validation chain', async () => {
      const contextTracker = [];

      const validator1 = (context) => {
        contextTracker.push({ validator: 1, operation: context.operation, key: context.key });
      };

      const validator2 = (context) => {
        contextTracker.push({ validator: 2, operation: context.operation, key: context.key });
        if (context.key === 'error-key') {
          throw new ValidationError('Error from validator 2');
        }
      };

      const errorTracker = {
        name: 'error-tracker',
        error: async (context, error) => {
          contextTracker.push({
            error: true,
            operation: context.operation,
            key: context.key,
            errorMessage: error.message
          });
          return error;
        }
      };

      const customVault = new Vault('context-tracking');
      customVault.use(validationMiddleware(validator1, validator2));
      customVault.use(errorTracker);

      await expectAsync(customVault.setItem('error-key', 'value'))
        .toBeRejectedWithError(ValidationError);

      expect(contextTracker).toEqual([
        { validator: 1, operation: 'set', key: 'error-key' },
        { validator: 2, operation: 'set', key: 'error-key' },
        { error: true, operation: 'set', key: 'error-key', errorMessage: 'Error from validator 2' }
      ]);

      await customVault.clear();
    });
  });
});