// Test 1: Default singleton import
import vault from '../index.mini.js';

console.log('✓ Default singleton import works');
console.log('Type:', typeof vault);
console.log('Has setItem:', typeof vault.setItem === 'function');
console.log('Has getItem:', typeof vault.getItem === 'function');

// Quick functional test
(async () => {
  try {
    await vault.setItem('test', 'value');
    const retrieved = await vault.getItem('test');
    console.log('✓ Basic operations work:', retrieved === 'value');
    await vault.clear();
  } catch (e) {
    console.error('✗ Error:', e.message);
  }
})();