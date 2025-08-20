// Test 4: EncryptedVault import
import EncryptedVault from '../encrypted-vault.js';

console.log('✓ EncryptedVault import works');
console.log('Type:', typeof EncryptedVault);
console.log('Is constructor:', EncryptedVault.prototype.constructor === EncryptedVault);

// Create instance
const config = { password: 'test123', salt: 'testsalt' };
const encryptedVault = new EncryptedVault(config);
console.log('✓ Can create EncryptedVault instance');

(async () => {
  try {
    await encryptedVault.setItem('test', 'encrypted-value');
    const retrieved = await encryptedVault.getItem('test');
    console.log('✓ EncryptedVault works:', retrieved === 'encrypted-value');
    await encryptedVault.clear();
  } catch (e) {
    console.error('✗ Error:', e.message);
  }
})();