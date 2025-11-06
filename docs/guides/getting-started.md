# Getting Started with Vault Storage

Welcome to Vault Storage! This guide will get you up and running in just a few minutes.

## Installation

Install Vault Storage using npm or yarn:

```bash
# Using npm
npm install vault-storage --save

# Using yarn
yarn add vault-storage
```

## Your First Vault

The simplest way to use Vault Storage is with the default vault instance:

```javascript
import vault from 'vault-storage';

// Store data
await vault.setItem('username', 'john_doe');

// Retrieve data
const username = await vault.getItem('username');
console.log(username); // 'john_doe'
```

That's it! No configuration needed.

## Property-Style Access

For an even simpler API, use property syntax (just like localStorage):

```javascript
import vault from 'vault-storage';

// Set values
vault.username = 'john_doe';
vault.theme = 'dark';

// Get values (remember to await!)
const username = await vault.username; // 'john_doe'
const theme = await vault.theme; // 'dark'

// Delete values
delete vault.theme;
```

## Storing Complex Data

Unlike localStorage, Vault handles objects and arrays natively:

```javascript
// Store an object
await vault.setItem('user', {
  name: 'John Doe',
  email: 'john@example.com',
  preferences: {
    theme: 'dark',
    notifications: true
  }
});

// Retrieve and use
const user = await vault.getItem('user');
console.log(user.name); // 'John Doe'
console.log(user.preferences.theme); // 'dark'
```

## Creating Named Vaults

For different parts of your app, create separate vaults:

```javascript
import Vault from 'vault-storage/vault';

// User data vault
const userVault = new Vault('user-data');
await userVault.setItem('profile', userProfile);

// App settings vault
const settingsVault = new Vault('app-settings');
await settingsVault.setItem('theme', 'dark');

// Session vault
const sessionVault = new Vault('session');
await sessionVault.setItem('token', authToken);
```

Each vault is isolated - they don't interfere with each other.

## Encrypted Storage

For sensitive data, use EncryptedVault:

```javascript
import EncryptedVault from 'vault-storage/encrypted-vault';

// Create encrypted vault
const authVault = new EncryptedVault({
  password: 'your-secret-password',
  salt: 'your-unique-salt'
});

// Use it just like regular vault
await authVault.setItem('token', 'sensitive-auth-token');
await authVault.setItem('apiKey', 'super-secret-key');

// Data is automatically encrypted when stored
// and decrypted when retrieved
const token = await authVault.getItem('token');
```

## Auto-Expiring Data

Store temporary data with automatic expiration:

```javascript
import Vault from 'vault-storage/vault';
import { expiration } from 'vault-storage/middlewares';

const vault = new Vault('cache');

// Add expiration middleware
vault.use(expiration());

// Store with TTL (time-to-live)
await vault.setItem('temp-data', someData, {
  ttl: 3600000 // Expires in 1 hour (milliseconds)
});

// Or with absolute expiration time
await vault.setItem('session', sessionData, {
  expires: Date.now() + 3600000 // Expires at specific timestamp
});

// Expired items automatically return null
setTimeout(async () => {
  const data = await vault.getItem('temp-data'); // null if expired
}, 3700000);
```

## Data Validation

Ensure data integrity with validation middleware:

```javascript
import Vault from 'vault-storage/vault';
import { validation } from 'vault-storage/middlewares';

const vault = new Vault('validated-data');

// Add validation middleware
vault.use(validation(
  // Only allow specific keys
  (context) => {
    const allowedKeys = ['username', 'email', 'age'];
    if (!allowedKeys.includes(context.key)) {
      throw new Error(`Key '${context.key}' not allowed`);
    }
  },
  // Only allow objects as values
  (context) => {
    if (context.operation === 'set' && typeof context.value !== 'object') {
      throw new Error('Only objects allowed');
    }
  }
));

// This will work
await vault.setItem('username', { value: 'john' });

// This will throw an error
try {
  await vault.setItem('invalid-key', { value: 'data' });
} catch (error) {
  console.error(error.message); // "Key 'invalid-key' not allowed"
}
```

## Listening to Changes

React to storage changes with events:

```javascript
import vault from 'vault-storage';

// Listen to all changes
vault.on('change', (event) => {
  console.log('Operation:', event.detail.operation);
  console.log('Key:', event.detail.key);
  console.log('Value:', event.detail.value);
});

// Listen to specific operations
vault.on('set', (event) => {
  console.log(`Item added/updated: ${event.detail.key}`);
});

vault.on('delete', (event) => {
  console.log(`Item removed: ${event.detail.key}`);
});

// Now make changes
await vault.setItem('user', userData); // Triggers 'set' and 'change' events
await vault.removeItem('user'); // Triggers 'delete' and 'change' events
```

## Combining Multiple Features

The real power comes from combining features:

```javascript
import Vault from 'vault-storage/vault';
import { encryption, expiration, validation } from 'vault-storage/middlewares';

// Create a secure, validated, auto-expiring vault
const secureVault = new Vault('secure-data');

secureVault
  .use(validation((ctx) => {
    // Only allow non-empty keys
    if (!ctx.key || ctx.key.trim() === '') {
      throw new Error('Key cannot be empty');
    }
  }))
  .use(expiration({
    cleanupStrategy: 'background', // Clean up expired items in background
    cleanupInterval: 60000 // Every minute
  }))
  .use(encryption({
    password: 'my-secret-password',
    salt: 'my-salt'
  }));

// Store validated, encrypted, auto-expiring data
await secureVault.setItem('session', {
  userId: '12345',
  token: 'auth-token'
}, {
  ttl: 1800000 // 30 minutes
});

// Listen to events
secureVault.on('change', (event) => {
  console.log('Secure storage changed:', event.detail);
});
```

## Common Operations

### Check if key exists

```javascript
// Get the item
const value = await vault.getItem('username');
if (value !== null) {
  console.log('Username exists');
}

// Or check all keys
const keys = await vault.keys();
if (keys.includes('username')) {
  console.log('Username exists');
}
```

### Get all items

```javascript
const keys = await vault.keys();

for (const key of keys) {
  const value = await vault.getItem(key);
  console.log(`${key}:`, value);
}
```

### Count items

```javascript
const count = await vault.length();
console.log(`Vault contains ${count} items`);
```

### Clear all data

```javascript
await vault.clear();
console.log('Vault cleared');
```

### Store metadata

```javascript
// Store with custom metadata
await vault.setItem('article', articleData, {
  author: 'John Doe',
  created: Date.now(),
  tags: ['tech', 'tutorial'],
  version: 1
});

// Retrieve metadata
const meta = await vault.getItemMeta('article');
console.log('Author:', meta.author);
console.log('Tags:', meta.tags);
```

## Next Steps

Now that you know the basics, explore more:

- [Complete Vault API Reference](../api/vault.md)
- [EncryptedVault API](../api/encrypted-vault.md)
- [All Available Middlewares](../api/middlewares.md)
- [Working with Events](./events.md)
- [Custom Middleware Guide](./custom-middleware.md)
- [TypeScript Usage](./typescript.md)

## Quick Reference Card

```javascript
// Import
import vault from 'vault-storage';                    // Default vault
import Vault from 'vault-storage/vault';              // Vault class
import EncryptedVault from 'vault-storage/encrypted-vault';
import { encryption, expiration, validation } from 'vault-storage/middlewares';

// Basic Operations
await vault.setItem('key', value);                    // Store
const value = await vault.getItem('key');             // Retrieve
await vault.removeItem('key');                        // Remove
await vault.clear();                                  // Clear all

// Utility
const count = await vault.length();                   // Count items
const keys = await vault.keys();                      // Get all keys
const meta = await vault.getItemMeta('key');          // Get metadata

// Property syntax
vault.key = value;                                    // Store
const value = await vault.key;                        // Retrieve
delete vault.key;                                     // Remove

// Middleware
vault.use(middleware);                                // Add middleware
vault.use([middleware1, middleware2]);                // Multiple

// Events
vault.on('change', callback);                         // Listen
vault.off('change', callback);                        // Unlisten

// Create vaults
const v = new Vault('name');                          // Named vault
const e = new EncryptedVault(config);                 // Encrypted vault
```

Happy coding! 🚀
