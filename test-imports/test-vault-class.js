// Test 2: Vault class import
import Vault from '../vault.js';

console.log('✓ Vault class import works');
console.log('Type:', typeof Vault);
console.log('Is constructor:', Vault.prototype.constructor === Vault);

// Create instance
const customVault = new Vault('test-storage');
console.log('✓ Can create instance');

(async () => {
  try {
    await customVault.setItem('test', 'class-value');
    const retrieved = await customVault.getItem('test');
    console.log('✓ Class instance works:', retrieved === 'class-value');
    await customVault.clear();
  } catch (e) {
    console.error('✗ Error:', e.message);
  }
})();