// Import test for Vault class using karma/jasmine
import Vault from '../vault.js';

describe('Import Tests - Vault Class', () => {
  let customVault;

  beforeEach(async () => {
    customVault = new Vault('test-import-storage');
    await customVault.clear();
  });

  afterEach(async () => {
    if (customVault) {
      await customVault.clear();
    }
  });

  it('should import Vault class as default export', () => {
    expect(Vault).toBeDefined();
    expect(typeof Vault).toBe('function');
    expect(Vault.prototype.constructor).toBe(Vault);
  });

  it('should create instances that work', async () => {
    expect(customVault).toBeDefined();
    await customVault.setItem('test', 'class-value');
    const retrieved = await customVault.getItem('test');
    expect(retrieved).toBe('class-value');
  });
});