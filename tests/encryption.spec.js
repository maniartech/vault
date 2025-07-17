/**
 * Test suite for encryption middleware
 */

import Vault from '../vault.js';
import { encryptionMiddleware, EncryptionError } from '../middlewares/encryption.js';

// Use Jasmine's expect function
const expect = (actual) => ({
  to: {
    equal: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to equal ${expected}`);
      }
    },
    deep: {
      equal: (expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to deep equal ${JSON.stringify(expected)}`);
        }
      }
    },
    be: {
      null: () => {
        if (actual !== null) {
          throw new Error(`Expected ${actual} to be null`);
        }
      },
      undefined: () => {
        if (actual !== undefined) {
          throw new Error(`Expected ${actual} to be undefined`);
        }
      },
      instanceOf: (constructor) => {
        if (!(actual instanceof constructor)) {
          throw new Error(`Expected ${actual} to be instance of ${constructor.name}`);
        }
      }
    },
    include: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to include ${expected}`);
      }
    }
  },
  fail: (message) => {
    throw new Error(message);
  }
});

describe('Encryption Middleware', () => {
  let vault;
  const testConfig = {
    password: 'test-password-123',
    salt: 'test-salt-456'
  };

  beforeEach(async () => {
    vault = new Vault('encryption-test');
    await vault.clear();
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt string values', async () => {
      vault.use(encryptionMiddleware(testConfig));
      
      const testValue = 'Hello, encrypted world!';
      await vault.setItem('test-key', testValue);
      
      const retrieved = await vault.getItem('test-key');
      expect(retrieved).to.equal(testValue);
    });

    it('should encrypt and decrypt object values', async () => {
      vault.use(encryptionMiddleware(testConfig));
      
      const testObject = { name: 'John', age: 30, active: true };
      await vault.setItem('test-object', testObject);
      
      const retrieved = await vault.getItem('test-object');
      expect(retrieved).to.deep.equal(testObject);
    });

    it('should handle null and undefined values without encryption', async () => {
      vault.use(encryptionMiddleware(testConfig));
      
      await vault.setItem('null-key', null);
      await vault.setItem('undefined-key', undefined);
      
      expect(await vault.getItem('null-key')).to.be.null;
      expect(await vault.getItem('undefined-key')).to.be.undefined;
    });
  });

  describe('Configuration Options', () => {
    it('should work with function-based config', async () => {
      const configProvider = async (key) => ({
        password: `password-for-${key}`,
        salt: `salt-for-${key}`
      });
      
      vault.use(encryptionMiddleware(configProvider));
      
      const testValue = 'Function config test';
      await vault.setItem('func-test', testValue);
      
      const retrieved = await vault.getItem('func-test');
      expect(retrieved).to.equal(testValue);
    });

    it('should not encrypt when config is null', async () => {
      vault.use(encryptionMiddleware(null));
      
      const testValue = 'No encryption test';
      await vault.setItem('no-enc-key', testValue);
      
      const retrieved = await vault.getItem('no-enc-key');
      expect(retrieved).to.equal(testValue);
    });

    it('should respect custom key derivation iterations', async () => {
      vault.use(encryptionMiddleware(testConfig, { 
        keyDerivationIterations: 50000
      }));
      
      const testValue = 'Custom iterations test';
      await vault.setItem('iterations-test', testValue);
      
      const retrieved = await vault.getItem('iterations-test');
      expect(retrieved).to.equal(testValue);
    });
  });

  describe('Error Handling', () => {
    it('should throw EncryptionError for invalid operations', async () => {
      const invalidConfig = async () => {
        throw new Error('Config provider failed');
      };
      
      vault.use(encryptionMiddleware(invalidConfig));
      
      try {
        await vault.setItem('error-test', 'test value');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(EncryptionError);
        expect(error.message).to.include('Failed to encrypt value');
      }
    });

    it('should handle decryption errors gracefully', async () => {
      vault.use(encryptionMiddleware(testConfig));
      
      // Set a value with encryption
      await vault.setItem('decrypt-error-test', 'test value');
      
      // Create a new vault instance with different config to simulate decryption error
      const vault2 = new Vault('encryption-test');
      const differentConfig = {
        password: 'different-password',
        salt: 'different-salt'
      };
      vault2.use(encryptionMiddleware(differentConfig));
      
      try {
        await vault2.getItem('decrypt-error-test');
        expect.fail('Should have thrown a decryption error');
      } catch (error) {
        expect(error).to.be.instanceOf(EncryptionError);
        expect(error.message).to.include('Failed to decrypt value');
      }
    });
  });

  describe('Key Caching', () => {
    it('should cache encryption keys for performance', async () => {
      let configCallCount = 0;
      const configProvider = async (key) => {
        configCallCount++;
        return {
          password: `password-for-${key}`,
          salt: `salt-for-${key}`
        };
      };
      
      vault.use(encryptionMiddleware(configProvider));
      
      // Multiple operations with the same key should reuse cached key
      await vault.setItem('cache-test', 'value1');
      await vault.setItem('cache-test', 'value2');
      await vault.getItem('cache-test');
      
      // Config should only be called once for the same key
      expect(configCallCount).to.equal(1);
    });

    it('should respect maxCachedKeys limit', async () => {
      vault.use(encryptionMiddleware(testConfig, { 
        maxCachedKeys: 2
      }));
      
      // Add more keys than the cache limit
      await vault.setItem('key1', 'value1');
      await vault.setItem('key2', 'value2');
      await vault.setItem('key3', 'value3'); // Should evict key1 from cache
      
      // All values should still be retrievable
      expect(await vault.getItem('key1')).to.equal('value1');
      expect(await vault.getItem('key2')).to.equal('value2');
      expect(await vault.getItem('key3')).to.equal('value3');
    });
  });

  describe('Integration with Other Operations', () => {
    it('should work with metadata', async () => {
      vault.use(encryptionMiddleware(testConfig));
      
      const testValue = 'Value with metadata';
      const testMeta = { created: Date.now(), type: 'test' };
      
      await vault.setItem('meta-test', testValue, testMeta);
      
      const retrieved = await vault.getItem('meta-test');
      const retrievedMeta = await vault.getItemMeta('meta-test');
      
      expect(retrieved).to.equal(testValue);
      expect(retrievedMeta).to.deep.equal(testMeta);
    });

    it('should not interfere with other vault operations', async () => {
      vault.use(encryptionMiddleware(testConfig));
      
      await vault.setItem('test1', 'value1');
      await vault.setItem('test2', 'value2');
      
      const keys = await vault.keys();
      expect(keys).to.include('test1');
      expect(keys).to.include('test2');
      
      const length = await vault.length();
      expect(length).to.equal(2);
      
      await vault.removeItem('test1');
      expect(await vault.getItem('test1')).to.be.null;
      expect(await vault.getItem('test2')).to.equal('value2');
    });
  });
});