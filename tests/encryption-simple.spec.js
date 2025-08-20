/**
 * Simple test for encryption middleware to debug the issue
 */

import Vault from '../dist/vault.js';
import { encryptionMiddleware, EncryptionError } from '../dist/middlewares/encryption.js';

describe('Encryption Middleware - Simple Test', () => {
  let vault;
  const testConfig = {
    password: 'test-password-123',
    salt: 'test-salt-456'
  };

  beforeEach(async () => {
    vault = new Vault('encryption-simple-test');
    await vault.clear();
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  it('should encrypt and decrypt a simple string', async () => {
    vault.use(encryptionMiddleware(testConfig));

    const testValue = 'Hello World';
    console.log('Setting value:', testValue);

    await vault.setItem('test-key', testValue);
    console.log('Value set successfully');

    const retrieved = await vault.getItem('test-key');
    console.log('Retrieved value:', retrieved);

    if (retrieved !== testValue) {
      throw new Error(`Expected "${testValue}" but got "${retrieved}"`);
    }
  });

  it('should work with null config (no encryption)', async () => {
    vault.use(encryptionMiddleware(null));

    const testValue = 'Plain text';
    await vault.setItem('plain-key', testValue);

    const retrieved = await vault.getItem('plain-key');
    if (retrieved !== testValue) {
      throw new Error(`Expected "${testValue}" but got "${retrieved}"`);
    }
  });
});