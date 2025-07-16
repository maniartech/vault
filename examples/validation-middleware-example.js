/**
 * Example demonstrating the validation middleware usage
 */

import Vault from '../vault.js';
import { validationMiddleware, ValidationError } from '../middlewares/validation.js';

console.log('=== Basic Validation Middleware Example ===');

const vault = new Vault('validation-example');
vault.use(validationMiddleware()); // Basic validation with no custom validators

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

console.log('\n=== Custom Validation Example ===');

const customVault = new Vault('custom-validation-example');
customVault.use(validationMiddleware(
  // Custom validator 1: No admin keys
  (context) => {
    if (context.key && context.key.startsWith('admin_')) {
      throw new ValidationError('Admin keys are not allowed');
    }
  },
  // Custom validator 2: No password values
  (context) => {
    if (context.operation === 'set' && typeof context.value === 'string' && context.value.includes('password')) {
      throw new ValidationError('Values containing "password" are not allowed');
    }
  }
));

try {
  // This will work fine
  await customVault.setItem('user_data', 'safe content');
  console.log('✓ Valid custom item stored successfully');

  // This will be rejected by custom validator
  await customVault.setItem('admin_config', 'value');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('✗ Custom validation failed:', error.message);
  }
}

console.log('\n=== Type Validation Example ===');

const typeVault = new Vault('type-validation-example');
typeVault.use(validationMiddleware((ctx) => {
  if (ctx.operation === 'set') {
    const o = ctx.value;
    if (typeof o !== 'object' || !o.type) {
      throw new ValidationError('type missing!');
    }
  }
}));

try {
  // This will work fine
  await typeVault.setItem('key', { type: 'user', name: 'John' });
  console.log('✓ Valid typed object stored successfully');

  // This will be rejected by type validator
  await typeVault.setItem('key', { name: 'John' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('✗ Type validation failed:', error.message);
  }
}

console.log('=== Validation Middleware Examples Complete ===');