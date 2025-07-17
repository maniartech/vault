/**
 * Example demonstrating the encryption middleware usage
 */

import Vault from '../vault.js';
import { encryptionMiddleware } from '../middlewares/encryption.js';

// Example usage of encryption middleware
async function demonstrateEncryptionMiddleware() {
  console.log('=== Encryption Middleware Example ===');
  
  // Create a vault instance
  const vault = new Vault('encryption-example');
  
  // Clear any existing data
  await vault.clear();
  
  // Define encryption configuration
  const encConfig = {
    password: 'my-secret-password',
    salt: 'my-salt-value'
  };
  
  // Add encryption middleware to the vault
  vault.use(encryptionMiddleware(encConfig));
  
  console.log('1. Storing encrypted data...');
  
  // Store some data - it will be automatically encrypted
  await vault.setItem('user-data', {
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  });
  
  await vault.setItem('secret-message', 'This is a confidential message!');
  
  console.log('2. Retrieving and decrypting data...');
  
  // Retrieve data - it will be automatically decrypted
  const userData = await vault.getItem('user-data');
  const secretMessage = await vault.getItem('secret-message');
  
  console.log('User data:', userData);
  console.log('Secret message:', secretMessage);
  
  console.log('3. Demonstrating function-based config...');
  
  // Create another vault with function-based encryption config
  const vault2 = new Vault('encryption-example-2');
  await vault2.clear();
  
  // Function that provides different credentials per key
  const configProvider = async (key) => ({
    password: `password-for-${key}`,
    salt: `salt-for-${key}`
  });
  
  vault2.use(encryptionMiddleware(configProvider));
  
  await vault2.setItem('key1', 'Value for key 1');
  await vault2.setItem('key2', 'Value for key 2');
  
  console.log('Key1 value:', await vault2.getItem('key1'));
  console.log('Key2 value:', await vault2.getItem('key2'));
  
  console.log('4. Demonstrating no encryption (null config)...');
  
  // Create a vault with no encryption
  const vault3 = new Vault('no-encryption-example');
  await vault3.clear();
  
  vault3.use(encryptionMiddleware(null));
  
  await vault3.setItem('plain-data', 'This data is not encrypted');
  console.log('Plain data:', await vault3.getItem('plain-data'));
  
  console.log('=== Example Complete ===');
}

// Run the example
demonstrateEncryptionMiddleware().catch(console.error);