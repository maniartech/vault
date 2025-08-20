// Import test for EncryptedVault using karma/jasmine
import EncryptedVault from '../dist/encrypted-vault.js';

describe('Import Tests - EncryptedVault', () => {
  let encryptedVault;
  const testConfig = { password: 'test123', salt: 'testsalt' };

  beforeEach(async () => {
    encryptedVault = new EncryptedVault(testConfig);
    await encryptedVault.clear();
  });

  afterEach(async () => {
    if (encryptedVault) {
      await encryptedVault.clear();
    }
  });

  it('should import EncryptedVault as default export', () => {
    expect(EncryptedVault).toBeDefined();
    expect(typeof EncryptedVault).toBe('function');
    expect(EncryptedVault.prototype.constructor).toBe(EncryptedVault);
  });

  it('should create working instances', async () => {
    expect(encryptedVault).toBeDefined();
    await encryptedVault.setItem('test', 'encrypted-value');
    const retrieved = await encryptedVault.getItem('test');
    expect(retrieved).toBe('encrypted-value');
  });
});