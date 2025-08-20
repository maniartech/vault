// Import test for default singleton using karma/jasmine
import vault from '../dist/index.mini.js';

describe('Import Tests - Default Singleton', () => {
  beforeEach(async () => {
    await vault.clear();
  });

  afterEach(async () => {
    await vault.clear();
  });

  it('should import default singleton successfully', () => {
    expect(vault).toBeDefined();
    expect(typeof vault).toBe('object');
    expect(typeof vault.setItem).toBe('function');
    expect(typeof vault.getItem).toBe('function');
  });

  it('should work functionally', async () => {
    await vault.setItem('test', 'value');
    const retrieved = await vault.getItem('test');
    expect(retrieved).toBe('value');
  });
});