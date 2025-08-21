/**
 * Comprehensive tests for EncryptedVault class
 */

import EncryptedVault from '../dist/encrypted-vault.js';
import Vault from '../dist/vault.js';
import { EncryptionError } from '../dist/middlewares/encryption.js';

describe('EncryptedVault', () => {
  let encryptedVault;
  const testConfig = {
    password: 'test-password-123',
    salt: 'test-salt-456'
  };

  afterEach(async () => {
    if (encryptedVault) {
      await encryptedVault.clear();
    }
  });

  describe('Construction and Configuration', () => {
    it('should create EncryptedVault with basic configuration', () => {
      encryptedVault = new EncryptedVault(testConfig);
      expect(encryptedVault).toBeInstanceOf(EncryptedVault);
      expect(encryptedVault).toBeInstanceOf(Vault);
    });

    it('should create EncryptedVault with custom storage name', () => {
      encryptedVault = new EncryptedVault(testConfig, {
        storageName: 'custom-encrypted-storage'
      });
      expect(encryptedVault.storageName).toBe('custom-encrypted-storage');
    });

    it('should create EncryptedVault with custom encryption options', () => {
      encryptedVault = new EncryptedVault(testConfig, {
        keyDerivationIterations: 150000,
        maxCachedKeys: 5
      });
      expect(encryptedVault).toBeInstanceOf(EncryptedVault);
    });

    it('should create EncryptedVault with function-based config', () => {
      const configProvider = async (key) => ({
        password: `password-for-${key}`,
        salt: `salt-for-${key}`
      });

      encryptedVault = new EncryptedVault(configProvider);
      expect(encryptedVault).toBeInstanceOf(EncryptedVault);
    });

    it('should use default storage name when not specified', () => {
      encryptedVault = new EncryptedVault(testConfig);
      expect(encryptedVault.storageName).toBe('encrypted-vault-storage');
    });
  });

  describe('Basic Operations with Encryption', () => {
    beforeEach(() => {
      encryptedVault = new EncryptedVault(testConfig);
    });

    it('should store and retrieve string values with encryption', async () => {
      const testValue = 'This is a secret message';
      await encryptedVault.setItem('secret-string', testValue);

      const retrieved = await encryptedVault.getItem('secret-string');
      expect(retrieved).toBe(testValue);
    });

    it('should store and retrieve object values with encryption', async () => {
      const testObject = {
        username: 'john_doe',
        password: 'super_secret_123',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        },
        permissions: ['read', 'write', 'admin']
      };

      await encryptedVault.setItem('user-profile', testObject);

      const retrieved = await encryptedVault.getItem('user-profile');
      expect(retrieved).toEqual(testObject);
    });

    it('should store and retrieve array values with encryption', async () => {
      const testArray = [
        'sensitive-data-1',
        'sensitive-data-2',
        { type: 'confidential', data: 'secret-info' }
      ];

      await encryptedVault.setItem('secret-array', testArray);

      const retrieved = await encryptedVault.getItem('secret-array');
      expect(retrieved).toEqual(testArray);
    });

    it('should handle null and undefined values without encryption', async () => {
      await encryptedVault.setItem('null-value', null);
      await encryptedVault.setItem('undefined-value', undefined);

      const nullResult = await encryptedVault.getItem('null-value');
      const undefinedResult = await encryptedVault.getItem('undefined-value');

      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
    });

    it('should handle boolean values with encryption', async () => {
      await encryptedVault.setItem('bool-true', true);
      await encryptedVault.setItem('bool-false', false);

      expect(await encryptedVault.getItem('bool-true')).toBe(true);
      expect(await encryptedVault.getItem('bool-false')).toBe(false);
    });

    it('should handle numeric values with encryption', async () => {
      await encryptedVault.setItem('integer', 42);
      await encryptedVault.setItem('float', 3.14159);
      await encryptedVault.setItem('negative', -100);
      await encryptedVault.setItem('zero', 0);

      expect(await encryptedVault.getItem('integer')).toBe(42);
      expect(await encryptedVault.getItem('float')).toBe(3.14159);
      expect(await encryptedVault.getItem('negative')).toBe(-100);
      expect(await encryptedVault.getItem('zero')).toBe(0);
    });
  });

  describe('Metadata Handling', () => {
    beforeEach(() => {
      encryptedVault = new EncryptedVault(testConfig);
    });

    it('should store and retrieve metadata without encryption', async () => {
      const metadata = {
        created: Date.now(),
        category: 'user-data',
        version: '1.0',
        tags: ['important', 'confidential']
      };

      await encryptedVault.setItem('item-with-meta', 'encrypted-value', metadata);

      const retrievedMeta = await encryptedVault.getItemMeta('item-with-meta');
      expect(retrievedMeta).toEqual(metadata);

      const retrievedValue = await encryptedVault.getItem('item-with-meta');
      expect(retrievedValue).toBe('encrypted-value');
    });

    it('should handle complex metadata structures', async () => {
      const complexMeta = {
        audit: {
          created: Date.now(),
          createdBy: 'user123',
          lastModified: Date.now(),
          modifiedBy: 'user456'
        },
        permissions: {
          read: ['user123', 'admin'],
          write: ['admin'],
          delete: ['admin']
        },
        classification: 'confidential',
        retention: {
          keepUntil: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          autoDelete: true
        }
      };

      await encryptedVault.setItem('complex-item', { secret: 'data' }, complexMeta);

      const retrievedMeta = await encryptedVault.getItemMeta('complex-item');
      expect(retrievedMeta).toEqual(complexMeta);
    });

    it('should preserve metadata when value is null or undefined', async () => {
      const metadata = { type: 'placeholder', status: 'pending' };

      await encryptedVault.setItem('null-with-meta', null, metadata);
      await encryptedVault.setItem('undefined-with-meta', undefined, metadata);

      expect(await encryptedVault.getItemMeta('null-with-meta')).toEqual(metadata);
      expect(await encryptedVault.getItemMeta('undefined-with-meta')).toEqual(metadata);
    });
  });

  describe('Vault Operations', () => {
    beforeEach(() => {
      encryptedVault = new EncryptedVault(testConfig);
    });

    it('should support all basic vault operations', async () => {
      // Set multiple items
      await encryptedVault.setItem('item1', 'value1');
      await encryptedVault.setItem('item2', 'value2');
      await encryptedVault.setItem('item3', 'value3');

      // Get keys
      const keys = await encryptedVault.keys();
      expect(keys).toContain('item1');
      expect(keys).toContain('item2');
      expect(keys).toContain('item3');

      // Get length
      const length = await encryptedVault.length();
      expect(length).toBe(3);

      // Remove item
      await encryptedVault.removeItem('item2');
      expect(await encryptedVault.getItem('item2')).toBeNull();
      expect(await encryptedVault.length()).toBe(2);

      // Clear all
      await encryptedVault.clear();
      expect(await encryptedVault.length()).toBe(0);
      expect(await encryptedVault.keys()).toEqual([]);
    });

    it('should handle empty vault operations', async () => {
      expect(await encryptedVault.length()).toBe(0);
      expect(await encryptedVault.keys()).toEqual([]);
      expect(await encryptedVault.getItem('nonexistent')).toBeNull();
      expect(await encryptedVault.getItemMeta('nonexistent')).toBeNull();

      // Clear empty vault should not throw
      await expectAsync(encryptedVault.clear()).toBeResolved();
    });

    it('should handle removing nonexistent items', async () => {
      await expectAsync(encryptedVault.removeItem('nonexistent')).toBeResolved();
      expect(await encryptedVault.length()).toBe(0);
    });
  });

  describe('Proxy Functionality', () => {
    beforeEach(() => {
      encryptedVault = new EncryptedVault(testConfig);
    });

    // TODO: Fix EncryptedVault property-style access returning null instead of values
    it('should support property-style access for setting values', async () => {
        encryptedVault.username = 'john_doe';
        encryptedVault.secret = { password: '123456', token: 'abc123' };

        expect(await encryptedVault.getItem('username')).toBe('john_doe');
        expect(await encryptedVault.getItem('secret')).toEqual({ password: '123456', token: 'abc123' });
    });

    it('should support property-style access for getting values', async () => {
      await encryptedVault.setItem('profile', { name: 'John', age: 30 });
      await encryptedVault.setItem('settings', { theme: 'dark', notifications: true });

      const profile = await encryptedVault.profile;
      const settings = await encryptedVault.settings;

      expect(profile).toEqual({ name: 'John', age: 30 });
      expect(settings).toEqual({ theme: 'dark', notifications: true });
    });

    it('should support property-style deletion', async () => {
      await encryptedVault.setItem('temp-data', 'temporary');
      expect(await encryptedVault.getItem('temp-data')).toBe('temporary');

      delete encryptedVault['temp-data'];
      expect(await encryptedVault.getItem('temp-data')).toBeNull();
    });

    it('should return null for nonexistent properties', async () => {
      const result = await encryptedVault.nonexistentProperty;
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid encryption configuration', async () => {
      const invalidConfig = null;
      encryptedVault = new EncryptedVault(invalidConfig);

      // With null config, encryption should be disabled
      await encryptedVault.setItem('test', 'value');
      const result = await encryptedVault.getItem('test');
      expect(result).toBe('value');
    });

    it('should handle encryption provider errors', async () => {
      const faultyProvider = async () => {
        throw new Error('Encryption service unavailable');
      };

      encryptedVault = new EncryptedVault(faultyProvider);

      await expectAsync(encryptedVault.setItem('test', 'value'))
        .toBeRejectedWith(jasmine.any(EncryptionError));
    });

    it('should handle decryption errors gracefully', async () => {
      encryptedVault = new EncryptedVault(testConfig);
      await encryptedVault.setItem('encrypted-item', 'secret-value');

      // Create new vault with different config to simulate decryption error
      const differentConfig = {
        password: 'different-password',
        salt: 'different-salt'
      };
      const vault2 = new EncryptedVault(differentConfig);

      await expectAsync(vault2.getItem('encrypted-item'))
        .toBeRejectedWith(jasmine.any(EncryptionError));

      await vault2.clear();
    });

    it('should handle invalid key types', async () => {
      encryptedVault = new EncryptedVault(testConfig);

      // These should be caught by the base Vault validation
      await expectAsync(encryptedVault.setItem('', 'value'))
        .toBeRejectedWithError('Key must be a non-empty string');

      await expectAsync(encryptedVault.setItem(null, 'value'))
        .toBeRejectedWithError('Key must be a non-empty string');
    });

    it('should handle database operation errors', async () => {
      encryptedVault = new EncryptedVault(testConfig);

      // Mock database error by closing the database
      await encryptedVault.setItem('test', 'value'); // Initialize the database
      if (encryptedVault.db) {
        encryptedVault.db.close();
        encryptedVault.db = null;
      }

      // Should handle database reinitialization
      await expectAsync(encryptedVault.setItem('test2', 'value2')).toBeResolved();
    });
  });

  describe('Security and Encryption Validation', () => {
    beforeEach(() => {
      encryptedVault = new EncryptedVault(testConfig);
    });

    it('should encrypt different values to different ciphertexts', async () => {
      // Store two different values
      await encryptedVault.setItem('value1', 'secret-data-1');
      await encryptedVault.setItem('value2', 'secret-data-2');

      // Access the raw storage to verify encryption
      const rawVault = new Vault('encrypted-vault-storage');

      const raw1 = await rawVault.getItem('value1');
      const raw2 = await rawVault.getItem('value2');

      // Raw values should be different and not contain the original text
      expect(raw1).not.toBe('secret-data-1');
      expect(raw2).not.toBe('secret-data-2');
      expect(raw1).not.toBe(raw2);

      // But decrypted values should be correct
      expect(await encryptedVault.getItem('value1')).toBe('secret-data-1');
      expect(await encryptedVault.getItem('value2')).toBe('secret-data-2');

      await rawVault.clear();
    });

    it('should handle large data encryption efficiently', async () => {
      const largeData = {
        users: Array(1000).fill(null).map((_, i) => ({
          id: i,
          username: `user${i}`,
          email: `user${i}@example.com`,
          profile: {
            firstName: `First${i}`,
            lastName: `Last${i}`,
            preferences: {
              theme: i % 2 === 0 ? 'dark' : 'light',
              notifications: true,
              language: 'en'
            }
          }
        })),
        metadata: {
          created: Date.now(),
          version: '1.0',
          type: 'user-database'
        }
      };

      const startTime = performance.now();
      await encryptedVault.setItem('large-dataset', largeData);
      const setTime = performance.now();

      const retrieved = await encryptedVault.getItem('large-dataset');
      const getTime = performance.now();

      expect(retrieved).toEqual(largeData);

      // Performance check - operations should complete in reasonable time
      expect(setTime - startTime).toBeLessThan(5000); // 5 seconds for set
      expect(getTime - setTime).toBeLessThan(5000); // 5 seconds for get
    });

    it('should handle concurrent encryption operations', async () => {
      const operations = [];

      // Start multiple concurrent encryption operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          encryptedVault.setItem(`concurrent${i}`, `secret-value-${i}`)
        );
      }

      await Promise.all(operations);

      // Verify all values were encrypted and stored correctly
      for (let i = 0; i < 10; i++) {
        const retrieved = await encryptedVault.getItem(`concurrent${i}`);
        expect(retrieved).toBe(`secret-value-${i}`);
      }
    });
  });

  describe('Multiple Vault Instances', () => {
    it('should maintain encryption isolation between instances', async () => {
      const config1 = { password: 'password1', salt: 'salt1' };
      const config2 = { password: 'password2', salt: 'salt2' };

      const vault1 = new EncryptedVault(config1, { storageName: 'vault1' });
      const vault2 = new EncryptedVault(config2, { storageName: 'vault2' });

      await vault1.setItem('shared-key', 'vault1-data');
      await vault2.setItem('shared-key', 'vault2-data');

      expect(await vault1.getItem('shared-key')).toBe('vault1-data');
      expect(await vault2.getItem('shared-key')).toBe('vault2-data');

      await vault1.clear();
      await vault2.clear();
    });

    it('should prevent cross-vault data access with different encryption', async () => {
      const config1 = { password: 'password1', salt: 'salt1' };
      const config2 = { password: 'password2', salt: 'salt2' };

      const vault1 = new EncryptedVault(config1, { storageName: 'shared-storage' });
      await vault1.setItem('secret', 'encrypted-with-config1');

      const vault2 = new EncryptedVault(config2, { storageName: 'shared-storage' });

      // vault2 should not be able to decrypt vault1's data
      await expectAsync(vault2.getItem('secret'))
        .toBeRejectedWith(jasmine.any(EncryptionError));

      await vault1.clear();
    });

    it('should allow data sharing with same encryption configuration', async () => {
      const sharedConfig = { password: 'shared-password', salt: 'shared-salt' };

      const vault1 = new EncryptedVault(sharedConfig, { storageName: 'shared-storage' });
      const vault2 = new EncryptedVault(sharedConfig, { storageName: 'shared-storage' });

      await vault1.setItem('shared-secret', 'accessible-by-both');

      const retrievedByVault2 = await vault2.getItem('shared-secret');
      expect(retrievedByVault2).toBe('accessible-by-both');

      await vault1.clear();
    });
  });

  describe('Advanced Configuration', () => {
    it('should support custom key derivation iterations', async () => {
      encryptedVault = new EncryptedVault(testConfig, {
        keyDerivationIterations: 200000
      });

      await encryptedVault.setItem('high-security', 'sensitive-data');
      const retrieved = await encryptedVault.getItem('high-security');
      expect(retrieved).toBe('sensitive-data');
    });

    it('should support custom cache size limits', async () => {
      encryptedVault = new EncryptedVault(testConfig, {
        maxCachedKeys: 2
      });

      // Add more keys than cache limit
      await encryptedVault.setItem('key1', 'value1');
      await encryptedVault.setItem('key2', 'value2');
      await encryptedVault.setItem('key3', 'value3'); // Should evict key1

      // All values should still be accessible
      expect(await encryptedVault.getItem('key1')).toBe('value1');
      expect(await encryptedVault.getItem('key2')).toBe('value2');
      expect(await encryptedVault.getItem('key3')).toBe('value3');
    });

    it('should support per-key encryption configuration', async () => {
      let configCallCount = 0;
      const perKeyConfig = async (key) => {
        configCallCount++;
        return {
          password: `password-for-${key}`,
          salt: `salt-for-${key}`
        };
      };

      encryptedVault = new EncryptedVault(perKeyConfig);

      await encryptedVault.setItem('user-data', 'user-specific-encryption');
      await encryptedVault.setItem('admin-data', 'admin-specific-encryption');

      expect(await encryptedVault.getItem('user-data')).toBe('user-specific-encryption');
      expect(await encryptedVault.getItem('admin-data')).toBe('admin-specific-encryption');

      // Config should be called for each unique key
      expect(configCallCount).toBe(2);
    });
  });

  describe('Integration with Additional Middleware', () => {
    it('should work with additional middleware on top of encryption', async () => {
      const auditMiddleware = {
        name: 'audit',
        before: async (context) => {
          context.auditLog = { operation: context.operation, timestamp: Date.now() };
          return context;
        }
      };

      encryptedVault = new EncryptedVault(testConfig);
      encryptedVault.use(auditMiddleware);

      await encryptedVault.setItem('audited-secret', 'encrypted-and-audited');
      const result = await encryptedVault.getItem('audited-secret');
      expect(result).toBe('encrypted-and-audited');
    });

    it('should maintain middleware execution order with built-in encryption', async () => {
      const executionOrder = [];

      const orderMiddleware = {
        name: 'order-tracker',
        before: async (context) => {
          executionOrder.push(`before-${context.operation}`);
          return context;
        },
        after: async (context, result) => {
          executionOrder.push(`after-${context.operation}`);
          return result;
        }
      };

      encryptedVault = new EncryptedVault(testConfig);
      encryptedVault.use(orderMiddleware);

      await encryptedVault.setItem('order-test', 'value');

      // Should show encryption middleware executing before custom middleware
      expect(executionOrder).toEqual(['before-set', 'after-set']);
    });
  });
});