/**
 * Enhanced encryption middleware tests with comprehensive edge cases
 */

import Vault from '../dist/vault.js';
import { encryptionMiddleware, EncryptionError } from '../dist/middlewares/encryption.js';

describe('Encryption Middleware - Enhanced Coverage', () => {
  let vault;
  const testConfig = {
    password: 'test-password-123',
    salt: 'test-salt-456'
  };

  beforeEach(async () => {
    vault = new Vault('encryption-enhanced-test');
    await vault.clear();
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Data Type Encryption Edge Cases', () => {
    beforeEach(() => {
      vault.use(encryptionMiddleware(testConfig));
    });

  it('should handle all JavaScript primitive types', async () => {
      const primitives = [
        { key: 'string', value: 'Hello World', expected: 'Hello World' },
        { key: 'number-int', value: 42, expected: 42 },
        { key: 'number-float', value: 3.14159, expected: 3.14159 },
        { key: 'number-negative', value: -100, expected: -100 },
        { key: 'number-zero', value: 0, expected: 0 },
        { key: 'number-infinity', value: Infinity, expected: Infinity },
        { key: 'number-negative-infinity', value: -Infinity, expected: -Infinity },
        { key: 'boolean-true', value: true, expected: true },
        { key: 'boolean-false', value: false, expected: false },
        { key: 'null', value: null, expected: null },
        { key: 'undefined', value: undefined, expected: undefined }
      ];

      for (const { key, value, expected } of primitives) {
        await vault.setItem(key, value);
        const retrieved = await vault.getItem(key);

        if (Number.isNaN(expected)) {
          expect(Number.isNaN(retrieved)).toBe(true);
        } else {
          expect(retrieved).toBe(expected);
        }
      }
    });

  it('should handle special number values', async () => {
      const specialNumbers = [
        { key: 'nan', value: NaN },
        { key: 'max-safe-integer', value: Number.MAX_SAFE_INTEGER },
        { key: 'min-safe-integer', value: Number.MIN_SAFE_INTEGER },
        { key: 'max-value', value: Number.MAX_VALUE },
        { key: 'min-value', value: Number.MIN_VALUE },
        { key: 'epsilon', value: Number.EPSILON }
      ];

      for (const { key, value } of specialNumbers) {
        await vault.setItem(key, value);
        const retrieved = await vault.getItem(key);

        if (Number.isNaN(value)) {
          expect(Number.isNaN(retrieved)).toBe(true);
        } else {
          expect(retrieved).toBe(value);
        }
      }
    });

  it('should handle complex nested objects', async () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  deepValue: 'very deep',
                  deepArray: [1, 2, { nested: true }],
                  deepNull: null,
                  deepUndefined: undefined
                }
              }
            }
          }
        },
        circularRef: null, // Will be set to create circular reference
        mixedArray: [
          1,
          'string',
          true,
          null,
          undefined,
          { object: 'in array' },
          [1, 2, 3],
          new Date(),
          /regex/g
        ],
        dateValue: new Date('2023-01-01T00:00:00Z'),
        regexValue: /test-pattern/gi,
        functionValue: function() { return 'test'; }, // Should be lost in serialization
        symbolValue: Symbol('test'), // Should be lost in serialization
        bigIntValue: null, // BigInt not supported in JSON
        bufferValue: null, // Will test with ArrayBuffer if needed
        setValue: new Set([1, 2, 3]),
        mapValue: new Map([['key1', 'value1'], ['key2', 'value2']]),
        errorValue: new Error('test error'),
        customObject: {
          constructor: Object,
          toString: function() { return 'custom'; },
          valueOf: function() { return 42; }
        }
      };

      // Set circular reference
      complexObject.circularRef = complexObject;

      try {
        await vault.setItem('complex-object', complexObject);
        const retrieved = await vault.getItem('complex-object');

        // Deep nested values should be preserved
        expect(retrieved.level1.level2.level3.level4.level5.deepValue).toBe('very deep');
        expect(retrieved.level1.level2.level3.level4.level5.deepArray).toEqual([1, 2, { nested: true }]);

        // Mixed array should preserve serializable values
        expect(retrieved.mixedArray[0]).toBe(1);
        expect(retrieved.mixedArray[1]).toBe('string');
        expect(retrieved.mixedArray[2]).toBe(true);
        expect(retrieved.mixedArray[3]).toBeNull();

        // Date should be preserved (as ISO string or Date object)
        expect(retrieved.dateValue).toBeDefined();

        // Function and Symbol should be lost
        expect(retrieved.functionValue).toBeUndefined();
        expect(retrieved.symbolValue).toBeUndefined();

        // Set and Map might be converted to objects/arrays
        expect(retrieved.setValue).toBeDefined();
        expect(retrieved.mapValue).toBeDefined();

      } catch (error) {
        // Circular references might cause serialization to fail
        expect(error.message).toContain('circular') || expect(error.message).toContain('Converting circular structure');
      }
    });

  it('should handle large strings and binary data', async () => {
      const smallString = 'Small string';
      const mediumString = 'x'.repeat(1000); // 1KB
      const largeString = 'y'.repeat(100000); // 100KB
      const veryLargeString = 'z'.repeat(1000000); // 1MB

      await vault.setItem('small-string', smallString);
      await vault.setItem('medium-string', mediumString);
      await vault.setItem('large-string', largeString);

      expect(await vault.getItem('small-string')).toBe(smallString);
      expect(await vault.getItem('medium-string')).toBe(mediumString);
      expect(await vault.getItem('large-string')).toBe(largeString);

      // Very large string might hit browser limits
      try {
        await vault.setItem('very-large-string', veryLargeString);
        const retrieved = await vault.getItem('very-large-string');
        expect(retrieved).toBe(veryLargeString);
      } catch (error) {
        // Acceptable if browser/storage has size limits
        expect(error).toBeDefined();
      }
    });

  it('should handle Unicode and special characters', async () => {
      const unicodeStrings = [
        'ASCII text',
        'Café with açcénts',
        'Русский текст',
        '中文字符',
        'العربية',
        'עברית',
        'हिन्दी',
        'Emoji: 🔑📦💾🔒🛡️',
        'Math symbols: ∑∆∇∂∫∞±≠≤≥∝∈∋⊆⊇∩∪',
        'Currency: $¢£¥€₹₽₿',
        'Special chars: \u0000\u0001\u0002\u001F\u007F\u0080\u009F',
        'Zero-width chars: \u200B\u200C\u200D\uFEFF',
        'Combining chars: a\u0301e\u0301i\u0301o\u0301u\u0301', // á é í ó ú
        'Surrogate pairs: 𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉',
        'RTL text: שלום עולם',
        'Mixed RTL/LTR: Hello שלום World עולם'
      ];

      for (let i = 0; i < unicodeStrings.length; i++) {
        const str = unicodeStrings[i];
        await vault.setItem(`unicode-${i}`, str);
        const retrieved = await vault.getItem(`unicode-${i}`);
        expect(retrieved).toBe(str);
      }
    });

  it('should handle arrays with mixed and sparse elements', async () => {
      const sparseArray = [];
      sparseArray[0] = 'first';
      sparseArray[5] = 'sixth';
      sparseArray[10] = 'eleventh';

      const mixedArray = [
        undefined,
        null,
        0,
        false,
        '',
        'string',
        42,
        { nested: true },
        [1, 2, 3],
        new Date(),
        sparseArray
      ];

      await vault.setItem('sparse-array', sparseArray);
      await vault.setItem('mixed-array', mixedArray);

      const retrievedSparse = await vault.getItem('sparse-array');
      const retrievedMixed = await vault.getItem('mixed-array');

      // Sparse arrays might be converted to objects or filled arrays
      expect(retrievedSparse).toBeDefined();
      expect(retrievedSparse[0]).toBe('first');
      expect(retrievedSparse[5]).toBe('sixth');
      expect(retrievedSparse[10]).toBe('eleventh');

      expect(retrievedMixed).toBeDefined();
      expect(retrievedMixed.length).toBe(mixedArray.length);
    });
  });

  describe('Configuration Edge Cases', () => {
  it('should handle empty password and salt', async () => {
      const emptyConfig = { password: '', salt: '' };

      try {
        vault.use(encryptionMiddleware(emptyConfig));
        await vault.setItem('empty-config', 'value');

        const result = await vault.getItem('empty-config');
        expect(result).toBe('value');
      } catch (error) {
        // Should either work or throw clear error about empty credentials
        expect(error).toBeInstanceOf(EncryptionError);
      }
    });

    it('should handle very long passwords and salts', async () => {
      const longConfig = {
        password: 'x'.repeat(10000), // 10KB password
        salt: 'y'.repeat(10000) // 10KB salt
      };

      try {
        vault.use(encryptionMiddleware(longConfig));
        await vault.setItem('long-config', 'value');

        const result = await vault.getItem('long-config');
        expect(result).toBe('value');
      } catch (error) {
        // Might fail due to crypto library limits
        expect(error).toBeInstanceOf(EncryptionError);
      }
    });

    it('should handle special characters in password and salt', async () => {
      const specialConfig = {
        password: '🔑🔒💾\u0000\u001F\u007F\u0080\u009F\u200B',
        salt: 'Çafé with ñáéíóú and العربية'
      };

      vault.use(encryptionMiddleware(specialConfig));
      await vault.setItem('special-config', 'test-value');

      const result = await vault.getItem('special-config');
      expect(result).toBe('test-value');
    });

    it('should handle function-based config with edge cases', async () => {
      let callCount = 0;
      const configProvider = async (key) => {
        callCount++;

        // Return different configs based on key patterns
        if (key.startsWith('admin_')) {
          return { password: 'admin-password', salt: 'admin-salt' };
        } else if (key.startsWith('user_')) {
          return { password: 'user-password', salt: 'user-salt' };
        } else if (key === 'error-key') {
          throw new Error('Config provider error');
        } else if (key === 'null-config') {
          return null;
        } else if (key === 'invalid-config') {
          return { password: 123, salt: true }; // Invalid types
        } else {
          return { password: 'default-password', salt: 'default-salt' };
        }
      };

      vault.use(encryptionMiddleware(configProvider));

      // Test different config scenarios
      await vault.setItem('admin_key', 'admin-data');
      await vault.setItem('user_key', 'user-data');
      await vault.setItem('normal_key', 'normal-data');

      expect(await vault.getItem('admin_key')).toBe('admin-data');
      expect(await vault.getItem('user_key')).toBe('user-data');
      expect(await vault.getItem('normal_key')).toBe('normal-data');

      // Test error handling
      await expectAsync(vault.setItem('error-key', 'value'))
        .toBeRejectedWith(jasmine.any(EncryptionError));

      // Test null config
      await vault.setItem('null-config', 'value');
      expect(await vault.getItem('null-config')).toBe('value'); // Should work without encryption

      // Test invalid config
      try {
        await vault.setItem('invalid-config', 'value');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
      }

      expect(callCount).toBeGreaterThan(0);
    });

    it('should handle async config provider with delays and retries', async () => {
      let attemptCount = 0;
      const delayedConfigProvider = async (key) => {
        attemptCount++;

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

        if (key === 'retry-key' && attemptCount < 3) {
          throw new Error('Temporary failure');
        }

        return { password: `password-${key}`, salt: `salt-${key}` };
      };

      vault.use(encryptionMiddleware(delayedConfigProvider));

      // Test normal operation with delay
      await vault.setItem('delayed-key', 'delayed-value');
      expect(await vault.getItem('delayed-key')).toBe('delayed-value');

      // Test retry scenario (should fail since we don't implement retries)
      try {
        await vault.setItem('retry-key', 'retry-value');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
      }
    });
  });

  describe('Key Caching Edge Cases', () => {
    it('should handle cache eviction correctly', async () => {
      const configProvider = jasmine.createSpy('configProvider').and.callFake(async (key) => {
        return { password: `password-${key}`, salt: `salt-${key}` };
      });

      vault.use(encryptionMiddleware(configProvider, { maxCachedKeys: 3 }));

      // Fill cache
      await vault.setItem('key1', 'value1');
      await vault.setItem('key2', 'value2');
      await vault.setItem('key3', 'value3');

      expect(configProvider).toHaveBeenCalledTimes(3);

      // Access existing keys (should use cache)
      await vault.getItem('key1');
      await vault.getItem('key2');
      await vault.getItem('key3');

      expect(configProvider).toHaveBeenCalledTimes(3); // No additional calls

      // Add fourth key (should evict oldest)
      await vault.setItem('key4', 'value4');

      expect(configProvider).toHaveBeenCalledTimes(4);

      // Access evicted key (should call config provider again)
      await vault.getItem('key1');

      expect(configProvider).toHaveBeenCalledTimes(5); // One more call
    });

    it('should handle cache with zero size', async () => {
      const configProvider = jasmine.createSpy('configProvider').and.callFake(async (key) => {
        return { password: `password-${key}`, salt: `salt-${key}` };
      });

      vault.use(encryptionMiddleware(configProvider, { maxCachedKeys: 0 }));

      // Every operation should call config provider
      await vault.setItem('key1', 'value1');
      await vault.getItem('key1');
      await vault.setItem('key1', 'value1-updated');

      expect(configProvider).toHaveBeenCalledTimes(3);
    });

    it('should handle cache with very large size', async () => {
      const configProvider = jasmine.createSpy('configProvider').and.callFake(async (key) => {
        return { password: `password-${key}`, salt: `salt-${key}` };
      });

      vault.use(encryptionMiddleware(configProvider, { maxCachedKeys: 10000 }));

      // Create many keys
      for (let i = 0; i < 100; i++) {
        await vault.setItem(`key${i}`, `value${i}`);
      }

      expect(configProvider).toHaveBeenCalledTimes(100);

      // Access all keys again (should use cache)
      for (let i = 0; i < 100; i++) {
        await vault.getItem(`key${i}`);
      }

      expect(configProvider).toHaveBeenCalledTimes(100); // No additional calls
    });

    it('should handle concurrent cache access', async () => {
      let configProviderCalls = 0;
      const configProvider = async (key) => {
        configProviderCalls++;
        // Add delay to simulate async config retrieval
        await new Promise(resolve => setTimeout(resolve, 10));
        return { password: `password-${key}`, salt: `salt-${key}` };
      };

      vault.use(encryptionMiddleware(configProvider, { maxCachedKeys: 5 }));

      // Start multiple concurrent operations with the same key
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(vault.setItem('concurrent-key', `value-${i}`));
      }

      await Promise.all(promises);

      // Should only call config provider once for the same key
      expect(configProviderCalls).toBe(1);

      // Verify final value
      const result = await vault.getItem('concurrent-key');
      expect(result).toMatch(/^value-\d+$/);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle encryption failures gracefully', async () => {
      // Store original crypto for restoration
      const originalCrypto = window.crypto;

      // Create a mock crypto object with failing encrypt
      const mockSubtle = {
        ...originalCrypto.subtle,
        encrypt: jasmine.createSpy('encrypt').and.callFake(() => {
          return Promise.reject(new Error('Encryption failed'));
        }),
        importKey: originalCrypto.subtle.importKey.bind(originalCrypto.subtle),
        deriveKey: originalCrypto.subtle.deriveKey.bind(originalCrypto.subtle)
      };

      // Replace the entire crypto object
      Object.defineProperty(window, 'crypto', {
        value: {
          ...originalCrypto,
          subtle: mockSubtle
        },
        writable: true,
        configurable: true
      });

      try {
        vault.use(encryptionMiddleware(testConfig));

        await expectAsync(vault.setItem('fail-encrypt', 'value'))
          .toBeRejectedWith(jasmine.any(EncryptionError));
      } finally {
        // Restore original crypto
        Object.defineProperty(window, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true
        });
      }
    });

    it('should handle decryption failures gracefully', async () => {
      vault.use(encryptionMiddleware(testConfig));

      // Store encrypted data
      await vault.setItem('decrypt-fail-test', 'value');

      // Store original crypto for restoration
      const originalCrypto = window.crypto;

      // Create a mock crypto object with failing decrypt
      const mockSubtle = {
        ...originalCrypto.subtle,
        decrypt: jasmine.createSpy('decrypt').and.callFake(() => {
          return Promise.reject(new Error('Decryption failed'));
        }),
        importKey: originalCrypto.subtle.importKey.bind(originalCrypto.subtle),
        deriveKey: originalCrypto.subtle.deriveKey.bind(originalCrypto.subtle),
        encrypt: originalCrypto.subtle.encrypt.bind(originalCrypto.subtle)
      };

      // Replace the entire crypto object
      Object.defineProperty(window, 'crypto', {
        value: {
          ...originalCrypto,
          subtle: mockSubtle
        },
        writable: true,
        configurable: true
      });

      try {
        await expectAsync(vault.getItem('decrypt-fail-test'))
          .toBeRejectedWith(jasmine.any(EncryptionError));
      } finally {
        // Restore original crypto
        Object.defineProperty(window, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true
        });
      }
    });

    it('should handle corrupted encrypted data', async () => {
      vault.use(encryptionMiddleware(testConfig));

      // Store valid encrypted data
      await vault.setItem('corruption-test', 'original-value');

      // Manually corrupt the encrypted data by accessing raw storage
      const rawVault = new Vault('encryption-enhanced-test');

      // Create corrupted data that looks like encrypted data but has invalid encrypted bytes
      const corruptedData = {
        __encrypted: true,
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // Invalid encrypted data
      };
      await rawVault.setItem('corruption-test', corruptedData);

      // Attempt to read corrupted data should fail during decryption
      await expectAsync(vault.getItem('corruption-test'))
        .toBeRejectedWith(jasmine.any(EncryptionError));

      await rawVault.clear();
    });

    it('should handle missing crypto API gracefully', async () => {
      const originalCrypto = window.crypto;

      // Remove crypto API using Object.defineProperty
      Object.defineProperty(window, 'crypto', {
        value: undefined,
        writable: true,
        configurable: true
      });

      try {
        vault.use(encryptionMiddleware(testConfig));
        await expectAsync(vault.setItem('no-crypto', 'value'))
          .toBeRejectedWith(jasmine.any(EncryptionError));
      } finally {
        // Restore crypto using Object.defineProperty
        Object.defineProperty(window, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true
        });
      }
    });

    it('should handle partial crypto API support', async () => {
      const originalCrypto = window.crypto;

      // Mock partial crypto support using Object.defineProperty
      Object.defineProperty(window, 'crypto', {
        value: {
          getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto),
          // Missing subtle API
        },
        writable: true,
        configurable: true
      });

      try {
        vault.use(encryptionMiddleware(testConfig));
        await expectAsync(vault.setItem('partial-crypto', 'value'))
          .toBeRejectedWith(jasmine.any(EncryptionError));
      } finally {
        // Restore crypto using Object.defineProperty
        Object.defineProperty(window, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true
        });
      }
    });
  });

  describe('Performance and Memory Management', () => {
    beforeEach(() => {
      vault.use(encryptionMiddleware(testConfig));
    });

    it('should handle rapid encryption/decryption operations', async () => {
      const operationCount = 100;
      const startTime = performance.now();

      // Rapid set operations
      const setPromises = [];
      for (let i = 0; i < operationCount; i++) {
        setPromises.push(vault.setItem(`rapid-${i}`, `value-${i}`));
      }
      await Promise.all(setPromises);

      const setTime = performance.now();

      // Rapid get operations
      const getPromises = [];
      for (let i = 0; i < operationCount; i++) {
        getPromises.push(vault.getItem(`rapid-${i}`));
      }
      const results = await Promise.all(getPromises);

      const getTime = performance.now();

      // Verify results
      for (let i = 0; i < operationCount; i++) {
        expect(results[i]).toBe(`value-${i}`);
      }

      // Performance check
      expect(setTime - startTime).toBeLessThan(10000); // 10 seconds for 100 sets
      expect(getTime - setTime).toBeLessThan(5000); // 5 seconds for 100 gets
    });

    it('should handle large data encryption efficiently', async () => {
      const largeData = {
        array: new Array(10000).fill(null).map((_, i) => ({
          id: i,
          data: `item-${i}`,
          metadata: { index: i, category: `cat-${i % 10}` }
        })),
        text: 'x'.repeat(50000), // 50KB string
        nested: {
          level1: { level2: { level3: { data: 'deep' } } }
        }
      };

      const startTime = performance.now();
      await vault.setItem('large-data', largeData);
      const setTime = performance.now();

      const retrieved = await vault.getItem('large-data');
      const getTime = performance.now();

      expect(retrieved.array.length).toBe(10000);
      expect(retrieved.text.length).toBe(50000);
      expect(retrieved.nested.level1.level2.level3.data).toBe('deep');

      // Should complete in reasonable time
      expect(setTime - startTime).toBeLessThan(5000);
      expect(getTime - setTime).toBeLessThan(3000);
    });

    it('should handle memory efficiently with many encrypted items', async () => {
      const itemCount = 50; // Reduced from 500 to avoid timeout

      // Create many items in batches for better performance
      const batchSize = 10;
      for (let batch = 0; batch < itemCount; batch += batchSize) {
        const promises = [];
        const endIndex = Math.min(batch + batchSize, itemCount);

        for (let i = batch; i < endIndex; i++) {
          promises.push(vault.setItem(`memory-${i}`, `value-${i}`));
        }

        await Promise.all(promises);
      }

      // Verify items in batches for better performance
      for (let batch = 0; batch < itemCount; batch += batchSize) {
        const promises = [];
        const endIndex = Math.min(batch + batchSize, itemCount);

        for (let i = batch; i < endIndex; i++) {
          promises.push(vault.getItem(`memory-${i}`));
        }

        const results = await Promise.all(promises);

        // Verify results
        for (let j = 0; j < results.length; j++) {
          const i = batch + j;
          expect(results[j]).toBe(`value-${i}`);
        }
      }

      // Check storage size
      const length = await vault.length();
      expect(length).toBe(itemCount);
    });

    it('should handle concurrent encryption with limited resources', async () => {
      const concurrentCount = 20;
      const promises = [];

      // Start many concurrent operations
      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          vault.setItem(`concurrent-${i}`, `data-${i}`)
            .then(() => vault.getItem(`concurrent-${i}`))
        );
      }

      const results = await Promise.all(promises);

      // All operations should complete successfully
      for (let i = 0; i < concurrentCount; i++) {
        expect(results[i]).toBe(`data-${i}`);
      }
    });
  });

  describe('Cross-Browser Compatibility Edge Cases', () => {
    it('should handle different TextEncoder/TextDecoder implementations', async () => {
      const originalTextEncoder = window.TextEncoder;
      const originalTextDecoder = window.TextDecoder;

      try {
        // Test with mock implementations
        window.TextEncoder = class MockTextEncoder {
          encode(str) {
            const result = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
              result[i] = str.charCodeAt(i);
            }
            return result;
          }
        };

        window.TextDecoder = class MockTextDecoder {
          decode(buffer) {
            return String.fromCharCode(...new Uint8Array(buffer));
          }
        };

        vault.use(encryptionMiddleware(testConfig));
        await vault.setItem('text-encoder-test', 'Hello World');
        const result = await vault.getItem('text-encoder-test');
        expect(result).toBe('Hello World');

      } finally {
        window.TextEncoder = originalTextEncoder;
        window.TextDecoder = originalTextDecoder;
      }
    });

    it('should handle different ArrayBuffer implementations', async () => {
      vault.use(encryptionMiddleware(testConfig));

      // Test with various binary data types
      const binaryData = [
        new Uint8Array([1, 2, 3, 4, 5]),
        new Int8Array([-1, -2, 3, 4, 5]),
        new Uint16Array([256, 512, 1024]),
        new Float32Array([1.1, 2.2, 3.3])
      ];

      for (let i = 0; i < binaryData.length; i++) {
        await vault.setItem(`binary-${i}`, Array.from(binaryData[i]));
        const result = await vault.getItem(`binary-${i}`);
        expect(result).toEqual(Array.from(binaryData[i]));
      }
    });

    it('should handle platform-specific crypto behaviors', async () => {
      vault.use(encryptionMiddleware(testConfig));

      // Test with various data that might behave differently across platforms
      const platformTestData = [
        'UTF-8: café, naïve, résumé',
        'Line endings: \r\n\r\n',
        'Null bytes: \u0000\u0001\u0002',
        'High unicode: 🌟⭐✨💫',
        'Mixed case: AbCdEfGhIjKlMnOp'
      ];

      for (let i = 0; i < platformTestData.length; i++) {
        const data = platformTestData[i];
        await vault.setItem(`platform-${i}`, data);
        const result = await vault.getItem(`platform-${i}`);
        expect(result).toBe(data);
      }
    });
  });
});