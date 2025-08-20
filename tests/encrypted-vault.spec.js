/**
 * Test suite for EncryptedVault
 */
import { EncryptedVault } from '../dist/index.js';

describe('EncryptedVault', () => {
  let vault;
  const testConfig = {
    password: 'test-password-123',
    salt: 'test-salt-456'
  };

  beforeEach(async () => {
    vault = new EncryptedVault(testConfig);
    await vault.clear();
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Basic Functionality', () => {
    it('should encrypt and decrypt string values automatically', async () => {
      const testValue = 'Hello, encrypted world!';
      await vault.setItem('test-key', testValue);
      const retrieved = await vault.getItem('test-key');
      expect(retrieved).toBe(testValue);
    });

    it('should encrypt and decrypt object values automatically', async () => {
      const testObject = { name: 'John', age: 30, active: true };
      await vault.setItem('test-object', testObject);
      const retrieved = await vault.getItem('test-object');
      expect(retrieved).toEqual(testObject);
    });

    it('should handle null and undefined values', async () => {
      await vault.setItem('null-key', null);
      await vault.setItem('undefined-key', undefined);

      expect(await vault.getItem('null-key')).toBeNull();
      expect(await vault.getItem('undefined-key')).toBeUndefined();
    });
  });

  describe('Vault Operations', () => {
    it('should support all standard vault operations', async () => {
      // Set multiple items
      await vault.setItem('key1', 'value1');
      await vault.setItem('key2', 'value2');
      await vault.setItem('key3', { data: 'complex' });

      // Check keys
      const keys = await vault.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');

      // Check length
      expect(await vault.length()).toBe(3);

      // Remove item
      await vault.removeItem('key2');
      expect(await vault.getItem('key2')).toBeNull();
      expect(await vault.length()).toBe(2);

      // Verify remaining items
      expect(await vault.getItem('key1')).toBe('value1');
      expect(await vault.getItem('key3')).toEqual({ data: 'complex' });
    });

    it('should work with metadata', async () => {
      const testValue = 'Value with metadata';
      const testMeta = { created: Date.now(), type: 'test' };

      await vault.setItem('meta-test', testValue, testMeta);

      const retrieved = await vault.getItem('meta-test');
      const retrievedMeta = await vault.getItemMeta('meta-test');

      expect(retrieved).toBe(testValue);
      expect(retrievedMeta).toEqual(testMeta);
    });
  });

  describe('Configuration', () => {
    it('should work with function-based config', async () => {
      const configProvider = async (key) => ({
        password: `password-for-${key}`,
        salt: `salt-for-${key}`
      });

      const functionVault = new EncryptedVault(configProvider);
      await functionVault.clear();

      const testValue = 'Function config test';
      await functionVault.setItem('func-test', testValue);
      const retrieved = await functionVault.getItem('func-test');

      expect(retrieved).toBe(testValue);

      await functionVault.clear();
    });

    it('should accept custom storage name', async () => {
      const customVault = new EncryptedVault(testConfig, {
        storageName: 'custom-encrypted-storage'
      });
      await customVault.clear();

      await customVault.setItem('custom-test', 'custom value');
      const retrieved = await customVault.getItem('custom-test');

      expect(retrieved).toBe('custom value');

      await customVault.clear();
    });

    it('should accept encryption options', async () => {
      const optionsVault = new EncryptedVault(testConfig, {
        keyDerivationIterations: 50000,
        maxCachedKeys: 50
      });
      await optionsVault.clear();

      await optionsVault.setItem('options-test', 'options value');
      const retrieved = await optionsVault.getItem('options-test');

      expect(retrieved).toBe('options value');

      await optionsVault.clear();
    });
  });
});