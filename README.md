# Vault Storage

[![npm version](https://img.shields.io/npm/v/vault-storage.svg)](https://www.npmjs.com/package/vault-storage)
[![GitHub release](https://img.shields.io/github/v/release/maniartech/vault)](https://github.com/maniartech/vault/releases)

> **Note:** Version 2.0 is a major release with a new middleware architecture.
> For v1.x documentation, see [v1.3.4](https://github.com/maniartech/vault/tree/v1.3.4).

Vault Storage is a sophisticated browser-based storage library that leverages the power
of IndexedDB, offering significant improvements over traditional LocalStorage.
As a high-performance, asynchronous solution for client-side storage, it
provides an intuitive and easy-to-use API similar to local and session storage,
with extended capabilities through a powerful middleware system.
It supports structured data, multiple stores, automatic expiration, encryption,
validation, and event handling—all with a micro footprint.

## Features

- **Similar API**: Easy to use, similar to LocalStorage.
- **Lightweight**: No dependencies, micro footprint
  - Less than 1KB (minified and gzipped) - core vault
  - Modular architecture - only include what you need
- **Middleware System**: Extend functionality with composable middleware
  - Encryption middleware for secure storage
  - Validation middleware for data integrity
  - Expiration middleware for automatic cleanup
  - Custom middleware support
- **EncryptedVault**: Pre-configured vault with built-in encryption
- **Multiple Stores Support**: Supports multiple stores with single API
- **Store Additional Meta Data**: Store additional meta data along with the item value
- **Automatic Expiration**: Built-in TTL support with configurable cleanup strategies
- **Event System**: Listen to storage events (set, get, delete, clear)
- **Backup and Restore**: Export and import vault storage data
- **Asynchronous**: Non-blocking, asynchronous API
- **Structured Data**: Supports structured data, including objects and arrays
- **TypeScript Support**: Full TypeScript type definitions included

## Installation

Install `vault-storage` using npm:

```bash
npm install vault-storage --save
```

Or using yarn:

```bash
yarn add vault-storage
```

## Usage

First, import the `vault` from `vault-storage`. The `vault` is a default instance
of the `Vault` storage class and hence does not need any special initialization
or setup!!! The `vault` provides a ready to use instance similar to localStorage
and sessionStorage. You can start using it right away without any setup.

```javascript
import vault from 'vault-storage';
```

### Initializing and Setup

> **Just start using it!**

```javascript
// Set the values.
vault.key1 = "value1";
vault.key2 = "value2";

// Get the values. Remember to use await! As it's asynchronous.
const value1 = await vault.key1; // "value1"
const value2 = await vault.key2; // "value2"
```

### Custom Storage

You can also create a custom storage. This is useful when you want to use
multiple storages for different purposes. All the custom storage also share the
same API as the default vault storage and other built-in storages like
localStorage and sessionStorage.

```javascript
import Vault from 'vault-storage/vault';


const appStorage = new Vault("app-storage")
appStorage.setItem("key", "value")
console.log("key", await appStorage.getItem("key"))

const userStorage = new Vault("user-storage")
userStorage.setItem("key", "value")
```

### Encrypted Storage

**v2.0 introduces `EncryptedVault`** - a pre-configured vault with encryption middleware.
This is the recommended approach for storing sensitive data.

```javascript
import EncryptedVault from 'vault-storage/encrypted-vault';

// Create an encrypted vault with fixed credentials
const authStorage = new EncryptedVault({
  password: "your-secret-password",
  salt: "your-unique-salt",
});

// Usage is simple - encryption/decryption happens automatically
await authStorage.setItem("token", "sensitive-auth-token");
const token = await authStorage.getItem("token"); // Automatically decrypted

// -----

// Dynamic credentials based on key (more secure)
const authStorage = new EncryptedVault(async (key) => {
  // Generate different credentials per key
  const password = await derivePasswordForKey(key);
  const salt = await deriveSaltForKey(key);
  return { password, salt };
});

await authStorage.setItem("user-token", authToken);
const token = await authStorage.getItem("user-token");
```

**Security Best Practices:**

1. Use dynamic credentials (key-based) for better security
2. Never hardcode credentials in production code
3. Use asymmetric encryption for key transmission
4. Generate credentials using Web Crypto API
5. Fetch encrypted credentials from server and decrypt locally
6. Use Content Security Policy (CSP) headers
7. Always run in HTTPS (secure context)
8. Rotate credentials periodically or use unique credentials per key

### Middleware System (New in v2.0)

Vault v2.0 introduces a powerful middleware system that allows you to extend functionality
in a composable way. Middleware can intercept and modify operations before and after execution.

#### Using Encryption Middleware

```javascript
import Vault from 'vault-storage/vault';
import { encryption } from 'vault-storage/middlewares';

const vault = new Vault('my-storage');

// Add encryption middleware
vault.use(encryption({
  password: 'my-secret-password',
  salt: 'my-salt'
}));

// All operations are now encrypted
await vault.setItem('secret', 'sensitive data');
```

#### Using Validation Middleware

```javascript
import Vault from 'vault-storage/vault';
import { validation } from 'vault-storage/middlewares';

const vault = new Vault('my-storage');

// Add validation middleware with custom validators
vault.use(validation(
  // Validator 1: No admin keys
  (context) => {
    if (context.key?.startsWith('admin_')) {
      throw new Error('Admin keys not allowed');
    }
  },
  // Validator 2: Require object values
  (context) => {
    if (context.operation === 'set' && typeof context.value !== 'object') {
      throw new Error('Only objects allowed');
    }
  }
));

await vault.setItem('user', { name: 'John' }); // ✓ Valid
await vault.setItem('admin_key', 'value');      // ✗ Throws error
```

#### Using Expiration Middleware

```javascript
import Vault from 'vault-storage/vault';
import { expiration } from 'vault-storage/middlewares';

const vault = new Vault('my-storage');

// Add expiration middleware with proactive cleanup
vault.use(expiration({
  cleanupStrategy: 'proactive',
  cleanupInterval: 60000, // Clean every minute
}));

// Set item with TTL (time-to-live)
await vault.setItem('temp-data', 'value', {
  ttl: 3600000 // Expires in 1 hour
});

// Or use absolute expiration
await vault.setItem('session', 'data', {
  expires: Date.now() + 3600000
});

// Expired items are automatically removed and return null
setTimeout(async () => {
  const value = await vault.getItem('temp-data'); // null if expired
}, 3700000);
```

#### Combining Multiple Middlewares

```javascript
import Vault from 'vault-storage/vault';
import { encryption, validation, expiration } from 'vault-storage/middlewares';

const vault = new Vault('secure-storage');

// Chain multiple middlewares
vault
  .use(validation((ctx) => {
    if (!ctx.key) throw new Error('Key required');
  }))
  .use(encryption({ password: 'secret', salt: 'salt' }))
  .use(expiration({ cleanupStrategy: 'background' }));

// All middlewares are applied in order
await vault.setItem('key', { data: 'value' }, { ttl: 3600000 });
```

#### Creating Custom Middleware

```javascript
// Custom logging middleware
const loggingMiddleware = {
  name: 'logging',
  async beforeSet(context, next) {
    console.log(`Setting ${context.key}:`, context.value);
    await next();
  },
  async afterGet(context, next) {
    const result = await next();
    console.log(`Got ${context.key}:`, result);
    return result;
  }
};

vault.use(loggingMiddleware);
```

### Setting Values

Store data using the `setItem` method, indexer syntax, or dot notation:

```javascript

 // For set operation you can ignore await unless you want to wait for the
 // operation to complete or you want to catch any errors.
vault.setItem('yourKey', { any: 'data' });

// Indexer syntax.
vault['yourKey'] = { any: 'data' };

// Dot notation.
vault.yourKey = { any: 'data' };
```

### Getting Values

Retrieve data using the `getItem` method, indexer syntax, or dot notation. For get
operations you must use await as it's asynchronous.

```javascript
// Get the value using the getItem method.
const data = await vault.getItem('yourKey');

// Indexer syntax.
const data = await vault['yourKey'];

// Dot notation.
const data = await vault.yourKey;
```

### Removing Values

Remove data using the `removeItem` method:

```javascript
// Remove the value using the remove method.
vault.removeItem('yourKey');

// Indexer syntax.
delete vault['yourKey'];

// Dot notation.
delete vault.yourKey;
```

### Clearing All Data

Clear all data from the store:

```javascript
await vault.clear();
```

### Getting Store Length

Get the count of entries in the store:

```javascript
const count = await vault.length();
console.log(count);
```

### Working with Events (New in v2.0)

Vault v2.0 includes a built-in event system that allows you to listen to storage changes.

```javascript
import vault from 'vault-storage';

// Listen to all change events
vault.on('change', (event) => {
  console.log(`Operation: ${event.operation}`);
  console.log(`Key: ${event.key}`);
  console.log(`Value:`, event.value);
});

// Listen to specific operations
vault.on('set', (event) => {
  console.log(`Item set: ${event.key}`);
});

vault.on('delete', (event) => {
  console.log(`Item deleted: ${event.key}`);
});

vault.on('clear', () => {
  console.log('Vault cleared');
});

// Set an item - triggers 'set' and 'change' events
await vault.setItem('user', { name: 'John' });
```

### Working with Item Meta Data

You can also store meta data along with the item value. The meta data is useful
when you want to store some additional information about the item. The meta data
is stored along with the item value and can be retrieved using the `getItemMeta` method.

```javascript
// Set the additional meta data along with the item value.
vault.setItem('yourKey', { any: 'data' }, {
  roles: ['editor', 'moderator'],
});

// Get the meta data for the specified item.
const meta = await vault.getItemMeta('yourKey');
console.log(`yourKey is marked for '${meta.roles}' roles! `);

if (user.roles.some(role => meta.roles.includes(role))) {
  // User has access to the specified item in the vault.
}
```

### Backup and Restore Vault Storage

With version 1.3 and above, you can export and import the vault storage data. Please note that while exporting the secured storage data, the data is exported in non-encrypted form. You must be careful while exporting the data and ensure that the data is exported in a secure manner.

> We are still considering the best way to export the secured storage data in an encrypted form. If you have any suggestions, please let us know.

```javascript
import { importData, exportData } from 'vault-storage/backup';

const data = await exportData(vault);

// You can now save the data to a file or send it to the server.
// For example, you can save the data to a file using the following code.
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url
a.download = 'vault-data.json';
a.click();

// To import the data back to the vault, you can use the following code.
const importedData = await importData(data);
```

## API Reference

### `Vault` Class

The `Vault` class is the foundation of the storage system, providing functionality similar to `localStorage` and `sessionStorage` with enhanced capabilities. It supports middleware, events, and advanced features.

```javascript
import Vault from 'vault-storage/vault';
```

**Methods:**
- `setItem(key: string, value: any, meta?: any)`: Store data in the storage
- `getItem(key: string)`: Retrieve data from the storage
- `removeItem(key: string)`: Remove data from the storage
- `clear()`: Clear all data from the storage
- `length()`: Get the count of entries in the storage
- `getItemMeta(key: string)`: Get metadata for a specific item
- `use(middleware)`: Add middleware to the vault (returns `this` for chaining)
- `on(event, callback)`: Listen to vault events
- `off(event, callback)`: Remove event listener

### `EncryptedVault` Class (New in v2.0)

Pre-configured `Vault` with encryption middleware built-in. Recommended for storing sensitive data.

```javascript
import EncryptedVault from 'vault-storage/encrypted-vault';

const vault = new EncryptedVault({
  password: 'secret',
  salt: 'salt'
});
```

Inherits all methods from `Vault` class. All data is automatically encrypted/decrypted.

### `vault` Default Instance

The `vault` is a default instance of the `Vault` class, providing a ready-to-use storage solution without any setup or initialization.

```javascript
import vault from 'vault-storage';
```

### Middleware

Middleware can be imported from `vault-storage/middlewares`:

```javascript
import { encryption, validation, expiration } from 'vault-storage/middlewares';
```

**Available Middleware:**
- `encryption(config, options?)`: Encrypts/decrypts data transparently
- `validation(...validators)`: Validates operations with custom rules
- `expiration(options?)`: Automatic expiration with configurable cleanup strategies

**Cleanup Strategies for Expiration:**
- `immediate`: Check on every get operation (default)
- `background`: Background worker with periodic cleanup
- `hybrid`: Combines immediate checking with background cleanup
- `proactive`: Aggressive background cleanup with health monitoring

### Backup and Restore Functions

```javascript
import { exportData, importData } from 'vault-storage/backup';
```

- `exportData(vault: Vault)`: Export vault storage data (returns Promise<any>)
- `importData(vault: Vault, data: any)`: Import vault storage data (returns Promise<void>)

**Note:** Encrypted data is exported in decrypted form. Handle with care.

## Comparing Vault storage with LocalStorage

| Feature                  | Vault v2.0               | LocalStorage           |
|--------------------------|--------------------------|------------------------|
| **API Complexity**       | Simple, intuitive API    | Simple, intuitive API  |
| **Capacity**             | Large (up to browser limit, often no less than 250MB) | Limited (5MB typical)  |
| **Multiple Stores**      | ✅ Supports multiple stores | ❌ Single store        |
| **Meta Data**            | ✅ Supports storing meta data | ❌ No meta data support |
| **Encryption**           | ✅ Built-in EncryptedVault & middleware | ❌ No built-in encryption |
| **Validation**           | ✅ Middleware-based validation | ❌ No validation       |
| **Auto-Expiration**      | ✅ TTL with multiple cleanup strategies | ❌ No expiration      |
| **Events**               | ✅ Built-in event system | ❌ No events (except `storage` event) |
| **Middleware System**    | ✅ Extensible middleware architecture | ❌ Not applicable      |
| **Data Types**           | Supports structured data, objects, arrays | Only stores strings    |
| **Backup/Restore**       | ✅ Built-in import/export | ❌ Manual implementation needed |
| **Performance**          | Asynchronous, non-blocking | Synchronous, can block UI |
| **TypeScript**           | ✅ Full type definitions | ✅ Basic types via @types/web |
| **Bundle Size**          | < 1KB core, modular      | Native (0KB)           |

## The Roadmap

### ✅ Completed Features (v1.x - v2.0)

#### Core Features (v1.0)
- [x] Extensible Vault class with qualities:
  - Simple interface similar to local and session storages
  - Supports indexers and dot notation for intuitive access
  - Store large amounts of data
  - Perform transactions in non-blocking asynchronous manner
- [x] Global default vault instance for ease of use
- [x] Support for custom databases

#### Encryption Features (v1.1 - v2.0)
- [x] Support for secured vault storage
- [x] Dynamic password and salt support
- [x] **v2.0:** EncryptedVault class with middleware-based encryption
- [x] **v2.0:** Encryption middleware for composable encryption

#### Advanced Features (v1.2 - v2.0)
- [x] Support for storing and retrieving metadata along with item values
- [x] Vault data backup and restore
- [x] **v2.0:** Automatic expiration through `expires` and `ttl` metadata
- [x] **v2.0:** Multiple cleanup strategies (immediate, background, hybrid, proactive)
- [x] **v2.0:** Event system for storage changes
- [x] **v2.0:** Validation middleware
- [x] **v2.0:** Middleware architecture for extensibility

### 🚀 Planned Features (Future Releases)

#### Performance & Optimization
- [ ] Query API for advanced data filtering
- [ ] Indexing support for faster lookups
- [ ] Batch operations optimization
- [ ] Memory usage optimization for large datasets

#### Developer Experience
- [ ] DevTools integration for debugging
- [ ] Migration utilities for version upgrades
- [ ] Schema validation middleware
- [ ] Compression middleware

#### Advanced Middleware
- [ ] Sync middleware for cross-tab synchronization
- [ ] Diff-change middleware for change tracking
- [ ] Rate limiting middleware
- [ ] Retry middleware with exponential backoff

#### Platform Support
- [ ] React hooks package (`@vault-storage/react`)
- [ ] Vue composables package (`@vault-storage/vue`)
- [ ] Node.js adapter for SSR/testing

### 📊 Version 2.0 Highlights

The v2.0 release represents a major architectural improvement:

- **Middleware System**: Complete rewrite with composable middleware architecture
- **EncryptedVault**: New class for easy encrypted storage
- **Events**: Built-in event system for reactive applications
- **Expiration**: Advanced auto-expiration with multiple cleanup strategies
- **Validation**: Flexible validation middleware with custom validators
- **TypeScript**: Comprehensive type definitions
- **Testing**: 350+ tests with extensive coverage
- **Documentation**: Enhanced docs with real-world examples

- **Documentation**: Enhanced docs with real-world examples

## Migration from v1.x to v2.0

### Breaking Changes

1. **SecuredVault → EncryptedVault**
   - `SecuredVault` is deprecated (but still works for backward compatibility)
   - Use `EncryptedVault` instead for new projects

2. **Module Exports**
   - Main export now uses ES modules
   - Import paths have changed for better tree-shaking

### Migration Guide

**v1.x Code:**
```javascript
import SecuredVault from 'vault-storage/secured-vault';

const vault = new SecuredVault('my-storage', {
  password: 'secret',
  salt: 'salt'
});
```

**v2.0 Code (Recommended):**
```javascript
import EncryptedVault from 'vault-storage/encrypted-vault';

const vault = new EncryptedVault({
  password: 'secret',
  salt: 'salt'
}, {
  storageName: 'my-storage'
});
```

**Or use middleware approach:**
```javascript
import Vault from 'vault-storage/vault';
import { encryption } from 'vault-storage/middlewares';

const vault = new Vault('my-storage');
vault.use(encryption({ password: 'secret', salt: 'salt' }));
```

### New Features in v2.0

- **Middleware system** for composable functionality
- **Event system** for reactive storage
- **Auto-expiration** with TTL support
- **Validation middleware** for data integrity
- **Better TypeScript support** with full type definitions
- **Enhanced testing** with 350+ test cases

## Contributing

Contributions to `vault-storage` are welcome. Please ensure that your code adheres to the existing style and includes tests covering new features or bug fixes.

## License

`vault-storage` is [MIT licensed](./LICENSE).
