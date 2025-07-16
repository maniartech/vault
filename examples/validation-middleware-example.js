/**
 * Example demonstrating the validation middleware usage
 */

import Vault from '../vault.js';
import { validationMiddleware, ValidationError } from '../middlewares/validation.js';

console.log('=== Validation Middleware Example ===');

const vault = new Vault('validation-example');
vault.use(validationMiddleware);

try {
  // This will work fine
  await vault.setItem('valid-key', 'some value', { custom: 'metadata' });
  console.log('✓ Valid item stored successfully');
  
  // This will throw a ValidationError
  await vault.setItem('', 'value');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('✗ Validation failed:', error.message);
  }
}

try {
  // This will throw a ValidationError for invalid metadata
  await vault.setItem('key', 'value', 'invalid-meta');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('✗ Metadata validation failed:', error.message);
  }
}

try {
  // This will throw a ValidationError for null key
  await vault.getItem(null);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('✗ Key validation failed:', error.message);
  }
}

console.log('=== Validation Middleware Example Complete ===');