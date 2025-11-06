# Vault Class API Reference

Complete API reference for the `Vault` class - the foundation of Vault Storage.

## Table of Contents

- [Constructor](#constructor)
- [Storage Operations](#storage-operations)
- [Metadata Operations](#metadata-operations)
- [Middleware](#middleware)
- [Events](#events)
- [Utility Methods](#utility-methods)
- [Properties](#properties)

---

## Constructor

### `new Vault(storageName?, useProxy?)`

Creates a new Vault instance.

**Parameters:**
- `storageName` (string, optional): Name of the IndexedDB database. Default: `'vault-storage'`
- `useProxy` (boolean, optional): Whether to return a proxied instance for property access. Default: `true`

**Returns:** `Vault` instance (or Proxy wrapping the instance)

**Example:**
```javascript
import Vault from 'vault-storage/vault';

// Default vault
const vault = new Vault();

// Named vault
const appVault = new Vault('app-data');

// Without proxy (methods only)
const methodOnlyVault = new Vault('data', false);
```

---

## Storage Operations

### `setItem(key, value, meta?)`

Stores an item in the vault.

**Parameters:**
- `key` (string): The key to store the item under (non-empty string required)
- `value` (any): The value to store (supports any JSON-serializable data)
- `meta` (object, optional): Metadata to store alongside the value

**Returns:** `Promise<void>`

**Example:**
```javascript
// Simple value
await vault.setItem('username', 'john_doe');

// Complex object
await vault.setItem('user', {
  name: 'John Doe',
  email: 'john@example.com',
  preferences: { theme: 'dark' }
});

// With metadata
await vault.setItem('session', sessionData, {
  createdAt: Date.now(),
  ttl: 3600000, // 1 hour
  roles: ['user', 'editor']
});

// Using property syntax (requires proxy)
vault.username = 'john_doe';
await vault.setItem('username', 'john_doe'); // Equivalent
```

---

### `getItem(key)`

Retrieves an item from the vault.

**Parameters:**
- `key` (string): The key of the item to retrieve

**Returns:** `Promise<any>` - The stored value, or `null` if not found or expired

**Example:**
```javascript
const username = await vault.getItem('username');
console.log(username); // 'john_doe'

const user = await vault.getItem('user');
console.log(user.name); // 'John Doe'

// Using property syntax (requires proxy)
const username = await vault.username; // Equivalent

// Non-existent key
const missing = await vault.getItem('nonexistent'); // null
```

---

### `removeItem(key)`

Removes an item from the vault.

**Parameters:**
- `key` (string): The key of the item to remove

**Returns:** `Promise<void>`

**Example:**
```javascript
await vault.removeItem('username');

// Using delete syntax (requires proxy)
delete vault.username; // Equivalent

// Verify removal
const value = await vault.getItem('username'); // null
```

---

### `clear()`

Removes all items from the vault.

**Returns:** `Promise<void>`

**Example:**
```javascript
await vault.clear();

// Verify
const count = await vault.length(); // 0
```

---

### `length()`

Gets the number of items in the vault.

**Returns:** `Promise<number>` - Count of stored items

**Example:**
```javascript
await vault.setItem('key1', 'value1');
await vault.setItem('key2', 'value2');

const count = await vault.length();
console.log(count); // 2
```

---

### `keys()`

Gets all keys in the vault.

**Returns:** `Promise<string[]>` - Array of all keys

**Example:**
```javascript
await vault.setItem('username', 'john');
await vault.setItem('email', 'john@example.com');

const allKeys = await vault.keys();
console.log(allKeys); // ['username', 'email']

// Iterate over all items
for (const key of allKeys) {
  const value = await vault.getItem(key);
  console.log(`${key}: ${value}`);
}
```

---

## Metadata Operations

### `getItemMeta(key)`

Retrieves metadata for a specific item.

**Parameters:**
- `key` (string): The key of the item

**Returns:** `Promise<object | null>` - The metadata object, or `null` if not found

**Example:**
```javascript
// Store with metadata
await vault.setItem('session', sessionData, {
  createdAt: Date.now(),
  roles: ['user', 'admin'],
  ttl: 3600000
});

// Get metadata
const meta = await vault.getItemMeta('session');
console.log(meta.roles); // ['user', 'admin']
console.log(meta.createdAt); // timestamp

// Check expiration
if (meta.expires && Date.now() > meta.expires) {
  console.log('Item expired');
}
```

---

## Middleware

### `use(middleware)`

Adds middleware to the vault's middleware pipeline.

**Parameters:**
- `middleware` (Middleware | Middleware[]): Middleware function(s) to add

**Returns:** `this` (for method chaining)

**Example:**
```javascript
import { encryption, validation, expiration } from 'vault-storage/middlewares';

// Single middleware
vault.use(encryption({
  password: 'secret',
  salt: 'salt'
}));

// Chain multiple middlewares
vault
  .use(validation((ctx) => {
    if (!ctx.key) throw new Error('Key required');
  }))
  .use(expiration({ cleanupStrategy: 'background' }))
  .use(encryption({ password: 'secret', salt: 'salt' }));

// Array of middlewares
vault.use([
  validation(),
  expiration(),
  encryption({ password: 'secret', salt: 'salt' })
]);
```

---

## Events

### `on(event, callback)` / `addEventListener(event, callback, options?)`

Registers an event listener.

**Parameters:**
- `event` (string): Event name ('change', 'set', 'delete', 'clear', or custom)
- `callback` (Function): Event handler function
- `options` (object | boolean, optional): Event listener options

**Returns:** `void`

**Example:**
```javascript
// Listen to all changes
vault.on('change', (event) => {
  console.log('Operation:', event.detail.operation);
  console.log('Key:', event.detail.key);
  console.log('Value:', event.detail.value);
});

// Listen to specific operations
vault.on('set', (event) => {
  console.log(`Item set: ${event.detail.key}`);
});

vault.on('delete', (event) => {
  console.log(`Item deleted: ${event.detail.key}`);
});

vault.on('clear', () => {
  console.log('Vault cleared');
});

// Using addEventListener (standard API)
vault.addEventListener('change', (event) => {
  if (event.detail.key === 'user') {
    console.log('User data changed');
  }
});
```

---

### `off(event, callback)` / `removeEventListener(event, callback, options?)`

Removes an event listener.

**Parameters:**
- `event` (string): Event name
- `callback` (Function): Event handler to remove
- `options` (object | boolean, optional): Event listener options

**Returns:** `void`

**Example:**
```javascript
function onChange(event) {
  console.log('Changed:', event.detail.key);
}

// Add listener
vault.on('change', onChange);

// Remove listener
vault.off('change', onChange);

// Using removeEventListener
vault.removeEventListener('change', onChange);
```

---

### `dispatchEvent(event)`

Dispatches a custom event.

**Parameters:**
- `event` (Event): Event to dispatch

**Returns:** `boolean` - true if the event was not cancelled

**Example:**
```javascript
// Dispatch custom event
const event = new CustomEvent('custom-event', {
  detail: { message: 'Hello' }
});

vault.dispatchEvent(event);

// Listen to custom event
vault.on('custom-event', (e) => {
  console.log(e.detail.message); // 'Hello'
});
```

---

## Utility Methods

### `has(key)` (via Proxy)

Checks if a key exists in the vault.

**Parameters:**
- `key` (string): The key to check

**Returns:** `Promise<boolean>`

**Example:**
```javascript
await vault.setItem('username', 'john');

// Check existence
if (await vault.has('username')) {
  console.log('Username exists');
}

// Using 'in' operator (requires proxy)
if ('username' in vault) {
  const value = await vault.username;
}
```

---

## Properties

### `storageName`

**Type:** `string` (readonly)

The name of the IndexedDB database.

**Example:**
```javascript
const vault = new Vault('my-app');
console.log(vault.storageName); // 'my-app'
```

---

### `middlewares`

**Type:** `Middleware[]` (readonly)

Array of registered middlewares.

**Example:**
```javascript
vault.use(encryption({ password: 'secret', salt: 'salt' }));
console.log(vault.middlewares.length); // 1
console.log(vault.middlewares[0].name); // 'encryption'
```

---

## TypeScript Types

```typescript
interface VaultOptions {
  storageName?: string;
  useProxy?: boolean;
}

interface VaultItemMeta {
  createdAt?: number;
  updatedAt?: number;
  expires?: number;
  ttl?: number;
  [key: string]: any;
}

interface VaultItem {
  key: string;
  value: any;
  meta?: VaultItemMeta | null;
}

interface Vault {
  storageName: string;
  middlewares: Middleware[];

  setItem(key: string, value: any, meta?: VaultItemMeta): Promise<void>;
  getItem(key: string): Promise<any>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  length(): Promise<number>;
  keys(): Promise<string[]>;
  getItemMeta(key: string): Promise<VaultItemMeta | null>;

  use(middleware: Middleware | Middleware[]): this;

  on(event: string, callback: EventListener): void;
  off(event: string, callback: EventListener): void;
  addEventListener(event: string, callback: EventListener, options?: AddEventListenerOptions | boolean): void;
  removeEventListener(event: string, callback: EventListener, options?: EventListenerOptions | boolean): void;
  dispatchEvent(event: Event): boolean;
}
```

---

## Complete Usage Example

```javascript
import Vault from 'vault-storage/vault';
import { encryption, expiration, validation } from 'vault-storage/middlewares';

// Create and configure vault
const vault = new Vault('my-app');

// Add middleware
vault
  .use(validation((ctx) => {
    if (ctx.operation === 'set' && !ctx.key) {
      throw new Error('Key is required');
    }
  }))
  .use(expiration({ cleanupStrategy: 'background' }))
  .use(encryption({ password: 'secret', salt: 'salt' }));

// Listen to events
vault.on('change', (event) => {
  console.log(`${event.detail.operation} on ${event.detail.key}`);
});

// Store data
await vault.setItem('user', {
  name: 'John Doe',
  email: 'john@example.com'
}, {
  ttl: 3600000, // Expire in 1 hour
  roles: ['user', 'admin']
});

// Retrieve data
const user = await vault.getItem('user');
console.log(user.name); // 'John Doe'

// Get metadata
const meta = await vault.getItemMeta('user');
console.log(meta.roles); // ['user', 'admin']

// Check existence
if (await vault.has('user')) {
  console.log('User exists');
}

// Get all keys
const keys = await vault.keys();
console.log(keys); // ['user']

// Get count
const count = await vault.length();
console.log(count); // 1

// Remove item
await vault.removeItem('user');

// Clear all
await vault.clear();
```

---

## See Also

- [EncryptedVault API](encrypted-vault.md)
- [Middlewares API](middlewares.md)
- [Events Guide](../guides/events.md)
- [Basic Usage Guide](../guides/basic-usage.md)
