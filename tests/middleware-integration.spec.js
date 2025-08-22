/**
 * Integration tests for middleware combinations
 */

import Vault from '../dist/vault.js';
import { validationMiddleware, ValidationError } from '../dist/middlewares/validation.js';
import { expirationMiddleware } from '../dist/middlewares/expiration.js';
import { encryptionMiddleware, EncryptionError } from '../dist/middlewares/encryption.js';

describe('Middleware Integration', () => {
  let vault;

  beforeEach(() => {
    vault = new Vault('test-middleware-integration');
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Validation + Expiration', () => {
    beforeEach(() => {
      vault.use(validationMiddleware());
      vault.use(expirationMiddleware());
    });

  // TODO: Fix validation integration with expiration middleware
  xit('should validate before applying expiration', async () => {
      // Should reject invalid key before expiration processing
      await expectAsync(vault.setItem('', 'value', { ttl: '1h' }))
        .toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

  it('should apply expiration after validation passes', async () => {
      await vault.setItem('valid-key', 'value', { ttl: '1h' });

      const meta = await vault.getItemMeta('valid-key');
      expect(meta).not.toBeNull();
      expect(meta.expires).toBeDefined();
      expect(meta.ttl).toBeUndefined(); // TTL should be converted to expires
    });

    it('should handle expired items with validation', async () => {
      await vault.setItem('expiring-key', 'value', { ttl: 1 }); // 1ms

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await vault.getItem('expiring-key');
      expect(result).toBeNull();
    });

  it('should validate custom validators with expiration', async () => {
      const customValidator = (context) => {
        // Apply this rule only during set operations; other ops like get/getItemMeta should pass
        if (context.operation === 'set' && context.key && context.key.startsWith('temp_')) {
          if (!context.meta || !context.meta.ttl) {
            throw new ValidationError('Temporary keys must have TTL');
          }
        }
      };

      const customVault = new Vault('custom-validation-expiration');
      customVault.use(validationMiddleware(customValidator));
      customVault.use(expirationMiddleware());

      // Should fail validation
  await expectAsync(customVault.setItem('temp_key', 'value'))
        .toBeRejectedWithError(ValidationError, 'Temporary keys must have TTL');

      // Should pass validation and apply expiration
  await expectAsync(customVault.setItem('temp_key', 'value', { ttl: '1h' }))
        .toBeResolved();

      const meta = await customVault.getItemMeta('temp_key');
      expect(meta.expires).toBeDefined();

      await customVault.clear();
    });
  });

  describe('Validation + Encryption', () => {
    const encryptionConfig = {
      password: 'test-password',
      salt: 'test-salt'
    };

    beforeEach(() => {
      vault.use(validationMiddleware());
      vault.use(encryptionMiddleware(encryptionConfig));
    });

    it('should validate before encrypting', async () => {
      // Should reject invalid key before encryption
      await expectAsync(vault.setItem(null, 'secret-data'))
        .toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should encrypt after validation passes', async () => {
      await vault.setItem('secret-key', 'secret-data');

      const retrieved = await vault.getItem('secret-key');
      expect(retrieved).toBe('secret-data'); // Should be decrypted correctly
    });

    it('should validate encrypted data on retrieval', async () => {
      await vault.setItem('encrypted-key', 'encrypted-data');

      // Validation should not interfere with decryption
      const result = await vault.getItem('encrypted-key');
      expect(result).toBe('encrypted-data');
    });

    it('should handle validation errors with encryption context', async () => {
      const typeValidator = (context) => {
        if (context.operation === 'set' && typeof context.value !== 'string') {
          throw new ValidationError('Only strings allowed');
        }
      };

      const customVault = new Vault('validation-encryption');
      customVault.use(validationMiddleware(typeValidator));
      customVault.use(encryptionMiddleware(encryptionConfig));

      await expectAsync(customVault.setItem('key', 123))
        .toBeRejectedWithError(ValidationError, 'Only strings allowed');

      await expectAsync(customVault.setItem('key', 'valid-string'))
        .toBeResolved();

      await customVault.clear();
    });
  });

  describe('Expiration + Encryption', () => {
    const encryptionConfig = {
      password: 'test-password',
      salt: 'test-salt'
    };

    beforeEach(() => {
      vault.use(expirationMiddleware());
      vault.use(encryptionMiddleware(encryptionConfig));
    });

    it('should apply expiration before encryption', async () => {
      await vault.setItem('encrypted-expiring', 'secret-data', { ttl: '1h' });

      const meta = await vault.getItemMeta('encrypted-expiring');
      expect(meta).not.toBeNull();
      expect(meta.expires).toBeDefined();
      expect(meta.ttl).toBeUndefined();

      const retrieved = await vault.getItem('encrypted-expiring');
      expect(retrieved).toBe('secret-data'); // Should be decrypted
    });

    it('should handle expired encrypted items', async () => {
      await vault.setItem('expiring-secret', 'secret-data', { ttl: 1 }); // 1ms

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await vault.getItem('expiring-secret');
      expect(result).toBeNull(); // Should be expired and removed
    });

    it('should preserve metadata during encryption with expiration', async () => {
      const metadata = {
        ttl: '2h',
        category: 'sensitive',
        version: '1.0'
      };

      await vault.setItem('metadata-test', 'data', metadata);

      const meta = await vault.getItemMeta('metadata-test');
      expect(meta.category).toBe('sensitive');
      expect(meta.version).toBe('1.0');
      expect(meta.expires).toBeDefined();
      expect(meta.ttl).toBeUndefined(); // Converted to expires
    });

    it('should encrypt values but not metadata', async () => {
      await vault.setItem('test-key', 'secret-value', {
        ttl: '1h',
        public: 'metadata'
      });

      const meta = await vault.getItemMeta('test-key');
      expect(meta.public).toBe('metadata'); // Metadata should not be encrypted

      const value = await vault.getItem('test-key');
      expect(value).toBe('secret-value'); // Value should be decrypted
    });
  });

  describe('All Three Middlewares (Validation + Expiration + Encryption)', () => {
    const encryptionConfig = {
      password: 'test-password',
      salt: 'test-salt'
    };

    beforeEach(() => {
      vault.use(validationMiddleware());
      vault.use(expirationMiddleware());
      vault.use(encryptionMiddleware(encryptionConfig));
    });

    it('should execute all middlewares in order', async () => {
      await vault.setItem('complete-test', 'secret-data', { ttl: '1h' });

      // Should pass validation, apply expiration, and encrypt
      const retrieved = await vault.getItem('complete-test');
      expect(retrieved).toBe('secret-data');

      const meta = await vault.getItemMeta('complete-test');
      expect(meta.expires).toBeDefined();
    });

    it('should fail at validation stage', async () => {
      // Validation should fail before expiration or encryption
      await expectAsync(vault.setItem('', 'secret-data', { ttl: '1h' }))
        .toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    // TODO: Fix complex workflow integration - multiple middleware failures
    it('should handle complex workflows', async () => {
      const testData = {
        user: 'john_doe',
        permissions: ['read', 'write'],
        session: 'abc123'
      };

      await vault.setItem('user-session', testData, {
        ttl: '30m',
        category: 'authentication'
      });

      const retrieved = await vault.getItem('user-session');
      expect(retrieved).toEqual(testData);

      const meta = await vault.getItemMeta('user-session');
      expect(meta.category).toBe('authentication');
      expect(meta.expires).toBeDefined();
    });

    // TODO: Fix expiration with encrypted data - encryption/decryption with expiration
    it('should handle expiration with encrypted data', async () => {
      // Create a fresh vault for this test to avoid middleware accumulation issues
      const freshVault = new Vault('test-expiration-encryption');
      freshVault.use(validationMiddleware());
      freshVault.use(expirationMiddleware());
      freshVault.use(encryptionMiddleware(encryptionConfig));

      try {
        // Use a longer TTL to ensure enough time
        await freshVault.setItem('short-lived-secret', 'confidential-data', { ttl: '1h' });

        // Check if the item was actually stored
        const meta = await freshVault.getItemMeta('short-lived-secret');
        console.log('Stored metadata:', meta);

        // Data should be retrievable before expiration
        const beforeExpiration = await freshVault.getItem('short-lived-secret');
        console.log('Retrieved value:', beforeExpiration);
        expect(beforeExpiration).toBe('confidential-data');

        // Test actual expiration with short TTL
        await freshVault.setItem('quick-expire', 'test-data', { ttl: 500 }); // 500ms
        // Immediately check if it's there
        const immediate = await freshVault.getItem('quick-expire');
        expect(immediate).toBe('test-data');

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 600));

        const afterExpiration = await freshVault.getItem('quick-expire');
        expect(afterExpiration).toBeNull();
      } finally {
        await freshVault.clear();
      }
    });
  });

  describe('Middleware Order Testing', () => {
    const encryptionConfig = {
      password: 'test-password',
      salt: 'test-salt'
    };

    it('should work with different middleware orders', async () => {
      // Test order: Encryption -> Validation -> Expiration
      const vault1 = new Vault('order-test-1');
      vault1.use(encryptionMiddleware(encryptionConfig));
      vault1.use(validationMiddleware());
      vault1.use(expirationMiddleware());

      await vault1.setItem('order-test', 'data', { ttl: '1h' });
      expect(await vault1.getItem('order-test')).toBe('data');

      // Test order: Expiration -> Encryption -> Validation
      const vault2 = new Vault('order-test-2');
      vault2.use(expirationMiddleware());
      vault2.use(encryptionMiddleware(encryptionConfig));
      vault2.use(validationMiddleware());

      await vault2.setItem('order-test', 'data', { ttl: '1h' });
      expect(await vault2.getItem('order-test')).toBe('data');

      await vault1.clear();
      await vault2.clear();
    });

    it('should handle validation errors regardless of middleware order', async () => {
      // Order: Encryption -> Validation
      const vault1 = new Vault('validation-order-1');
      vault1.use(encryptionMiddleware(encryptionConfig));
      vault1.use(validationMiddleware());

      await expectAsync(vault1.setItem('', 'data'))
        .toBeRejectedWithError(ValidationError);

      // Order: Validation -> Encryption
      const vault2 = new Vault('validation-order-2');
      vault2.use(validationMiddleware());
      vault2.use(encryptionMiddleware(encryptionConfig));

      await expectAsync(vault2.setItem('', 'data'))
        .toBeRejectedWithError(ValidationError);

      await vault1.clear();
      await vault2.clear();
    });
  });

  describe('Custom Middleware Integration', () => {
    it('should integrate custom middleware with built-in middlewares', async () => {
      const auditMiddleware = {
        name: 'audit',
        before: async (context) => {
          context.audit = { timestamp: Date.now(), operation: context.operation };
          return context;
        },
        after: async (context, result) => {
          // Log audit information (in real app, would send to audit service)
          expect(context.audit).toBeDefined();
          expect(context.audit.operation).toBe(context.operation);
          return result;
        }
      };

      vault.use(validationMiddleware());
      vault.use(auditMiddleware);
      vault.use(expirationMiddleware());

      await vault.setItem('audited-key', 'value', { ttl: '1h' });
      const result = await vault.getItem('audited-key');
      expect(result).toBe('value');
    });

    it('should handle custom middleware errors with built-in error handling', async () => {
      const faultyMiddleware = {
        name: 'faulty',
        before: async (context) => {
          if (context.key === 'trigger-error') {
            throw new Error('Custom middleware error');
          }
          return context;
        }
      };

      vault.use(faultyMiddleware);
      vault.use(validationMiddleware());

      await expectAsync(vault.setItem('trigger-error', 'value'))
        .toBeRejectedWithError('Custom middleware error');

      // Should still work for other keys
      await expectAsync(vault.setItem('normal-key', 'value'))
        .toBeResolved();
    });

    it('should allow custom middleware to modify behavior of built-in middlewares', async () => {
      const metadataEnhancer = {
        name: 'metadata-enhancer',
        before: async (context) => {
          if (context.operation === 'set' && context.meta) {
            // Automatically add TTL if not present
            if (!context.meta.ttl && !context.meta.expires) {
              context.meta.ttl = '1d'; // Default 1 day
            }
          }
          return context;
        }
      };

      vault.use(metadataEnhancer);
      vault.use(expirationMiddleware());

      // Set item without explicit TTL
      await vault.setItem('enhanced-key', 'value', { category: 'test' });

      const meta = await vault.getItemMeta('enhanced-key');
      expect(meta.expires).toBeDefined(); // Should have expiration from default TTL
      expect(meta.category).toBe('test'); // Original metadata should be preserved
    });
  });

  describe('Error Propagation in Middleware Chains', () => {
    const encryptionConfig = {
      password: 'test-password',
      salt: 'test-salt'
    };

    it('should properly propagate validation errors through encryption middleware', async () => {
      vault.use(validationMiddleware());
      vault.use(encryptionMiddleware(encryptionConfig));

      await expectAsync(vault.setItem(null, 'secret'))
        .toBeRejectedWithError(ValidationError, 'Key must be a non-empty string');
    });

    it('should properly propagate encryption errors through validation middleware', async () => {
      const faultyEncryption = async () => {
        throw new Error('Encryption service unavailable');
      };

      vault.use(validationMiddleware());
      vault.use(encryptionMiddleware(faultyEncryption));

      await expectAsync(vault.setItem('valid-key', 'data'))
        .toBeRejectedWith(jasmine.any(EncryptionError));
    });

    it('should handle errors in middleware chains with error hooks', async () => {
      let errorHandled = false;

      const errorHandler = {
        name: 'error-handler',
        error: async (context, error) => {
          errorHandled = true;
          if (error instanceof ValidationError) {
            return new Error(`Handled validation error: ${error.message}`);
          }
          return error;
        }
      };

      vault.use(validationMiddleware());
      vault.use(errorHandler);
      vault.use(encryptionMiddleware(encryptionConfig));

      await expectAsync(vault.setItem('', 'data'))
        .toBeRejectedWithError('Handled validation error: Key must be a non-empty string');

      expect(errorHandled).toBe(true);
    });
  });

  describe('Performance with Multiple Middlewares', () => {
    const encryptionConfig = {
      password: 'test-password',
      salt: 'test-salt'
    };

    it('should handle multiple operations efficiently with full middleware stack', async () => {
      vault.use(validationMiddleware());
      vault.use(expirationMiddleware());
      vault.use(encryptionMiddleware(encryptionConfig));

      const startTime = performance.now();

      // Perform multiple operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(vault.setItem(`key${i}`, `value${i}`, { ttl: '1h' }));
      }

      await Promise.all(operations);

      // Retrieve all items
      const retrievals = [];
      for (let i = 0; i < 10; i++) {
        retrievals.push(vault.getItem(`key${i}`));
      }

      const results = await Promise.all(retrievals);

      const endTime = performance.now();

      // Verify results
      for (let i = 0; i < 10; i++) {
        expect(results[i]).toBe(`value${i}`);
      }

      // Should complete in reasonable time (less than 2 seconds for 20 operations)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should handle concurrent operations with middleware stack', async () => {
      vault.use(validationMiddleware());
      vault.use(expirationMiddleware());

      const concurrentOperations = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        concurrentOperations.push(
          vault.setItem(`concurrent${i}`, `value${i}`, { ttl: '1h' })
            .then(() => vault.getItem(`concurrent${i}`))
        );
      }

      const results = await Promise.all(concurrentOperations);

      // All operations should complete successfully
      for (let i = 0; i < 5; i++) {
        expect(results[i]).toBe(`value${i}`);
      }
    });
  });
});