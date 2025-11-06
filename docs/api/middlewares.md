# Middlewares API Reference

Complete API reference for all available middleware in Vault Storage v2.0.

## Table of Contents

- [Overview](#overview)
- [Encryption Middleware](#encryption-middleware)
- [Validation Middleware](#validation-middleware)
- [Expiration Middleware](#expiration-middleware)
- [Creating Custom Middleware](#creating-custom-middleware)

---

## Overview

Middlewares extend Vault functionality in a composable way. They can intercept operations before and after execution, transform data, validate inputs, and handle errors.

### Importing Middlewares

```javascript
// Import all middlewares
import { encryption, validation, expiration } from 'vault-storage/middlewares';

// Or import individually
import { encryption } from 'vault-storage/middlewares/encryption';
import { validation } from 'vault-storage/middlewares/validation';
import { expiration } from 'vault-storage/middlewares/expiration';
```

### Using Middlewares

```javascript
import Vault from 'vault-storage/vault';
import { encryption, validation } from 'vault-storage/middlewares';

const vault = new Vault('my-storage');

// Add single middleware
vault.use(encryption({ password: 'secret', salt: 'salt' }));

// Chain multiple middlewares
vault
  .use(validation())
  .use(encryption({ password: 'secret', salt: 'salt' }));
```

---

## Encryption Middleware

Transparently encrypts and decrypts all stored data using AES-GCM.

### Import

```javascript
import { encryption } from 'vault-storage/middlewares';
```

### Signature

```typescript
function encryption(
  config: EncryptionConfig,
  options?: EncryptionOptions
): Middleware
```

### Parameters

#### `config: EncryptionConfig`

Can be one of:

1. **Fixed credentials object:**
```javascript
{
  password: string,  // Encryption password
  salt: string       // Unique salt
}
```

2. **Async function** (returns credentials based on key):
```javascript
async (key: string) => ({
  password: string,
  salt: string
})
```

3. **Sync function** (returns credentials based on key):
```javascript
(key: string) => ({
  password: string,
  salt: string
})
```

4. **`null`** (no encryption):
```javascript
null  // Pass-through mode
```

#### `options?: EncryptionOptions`

```typescript
{
  keyCacheSize?: number;      // Max cached keys (default: 100)
  algorithm?: string;          // Algorithm name (default: 'AES-GCM')
  keyLength?: number;          // Key length in bits (default: 256)
  iterations?: number;         // PBKDF2 iterations (default: 100000)
}
```

### Usage Examples

#### Fixed Credentials

```javascript
import Vault from 'vault-storage/vault';
import { encryption } from 'vault-storage/middlewares';

const vault = new Vault('secure-storage');

vault.use(encryption({
  password: 'my-secret-password',
  salt: 'my-unique-salt'
}));

// All data is now encrypted
await vault.setItem('secret', 'sensitive data');
const secret = await vault.getItem('secret'); // Automatically decrypted
```

#### Dynamic Credentials (Key-Based)

```javascript
vault.use(encryption(async (key) => {
  // Different credentials per key
  if (key.startsWith('user-')) {
    return {
      password: 'user-password',
      salt: `salt-${key}`
    };
  }
  return {
    password: 'default-password',
    salt: 'default-salt'
  };
}));

await vault.setItem('user-123', userData);  // Uses user-specific credentials
await vault.setItem('config', configData);   // Uses default credentials
```

#### Fetching Credentials from Server

```javascript
vault.use(encryption(async (key) => {
  // Fetch encrypted credentials from server
  const response = await fetch(`/api/credentials/${key}`);
  const encryptedCreds = await response.json();

  // Decrypt locally using a pre-shared key
  const credentials = await decryptCredentials(encryptedCreds);

  return credentials; // { password, salt }
}));
```

#### Custom Options

```javascript
vault.use(encryption({
  password: 'secret',
  salt: 'salt'
}, {
  keyCacheSize: 50,      // Cache up to 50 keys
  iterations: 150000,    // Higher security (slower)
  keyLength: 256         // 256-bit keys
}));
```

#### No Encryption (Pass-through)

```javascript
// Useful for conditional encryption
const shouldEncrypt = process.env.NODE_ENV === 'production';

vault.use(encryption(shouldEncrypt ? {
  password: 'secret',
  salt: 'salt'
} : null));
```

---

## Validation Middleware

Validates data before storage operations using custom validator functions.

### Import

```javascript
import { validation } from 'vault-storage/middlewares';
```

### Signature

```typescript
function validation(...validators: CustomValidator[]): Middleware

type CustomValidator = (context: MiddlewareContext) => void | Promise<void>
```

### Parameters

**`...validators: CustomValidator[]`**

One or more validator functions. Each validator receives the middleware context and can throw an error to reject the operation.

### Usage Examples

#### Basic Validation

```javascript
import Vault from 'vault-storage/vault';
import { validation } from 'vault-storage/middlewares';

const vault = new Vault('validated-storage');

vault.use(validation());

// Basic validation is automatically applied:
// - Non-empty keys
// - Valid metadata (object or null)
```

#### Custom Validators

```javascript
vault.use(validation(
  // Validator 1: No admin keys
  (context) => {
    if (context.key?.startsWith('admin_')) {
      throw new Error('Admin keys not allowed');
    }
  },

  // Validator 2: Only objects as values
  (context) => {
    if (context.operation === 'set') {
      if (typeof context.value !== 'object') {
        throw new Error('Only objects allowed');
      }
    }
  },

  // Validator 3: Required fields
  (context) => {
    if (context.operation === 'set') {
      const value = context.value;
      if (!value.id || !value.type) {
        throw new Error('id and type are required');
      }
    }
  }
));

// Valid operation
await vault.setItem('user', {
  id: '123',
  type: 'user',
  name: 'John'
});

// Invalid - will throw error
try {
  await vault.setItem('admin_user', { data: 'test' });
} catch (error) {
  console.error(error.message); // 'Admin keys not allowed'
}
```

#### Async Validators

```javascript
vault.use(validation(
  async (context) => {
    if (context.operation === 'set') {
      // Check against API
      const isValid = await validateWithAPI(context.value);
      if (!isValid) {
        throw new Error('Validation failed');
      }
    }
  }
));
```

#### Key Pattern Validation

```javascript
vault.use(validation(
  (context) => {
    // Only allow specific key patterns
    const validPattern = /^[a-z0-9_-]+$/;
    if (!validPattern.test(context.key)) {
      throw new Error('Key must be lowercase alphanumeric with hyphens/underscores');
    }
  }
));
```

#### Value Schema Validation

```javascript
vault.use(validation(
  (context) => {
    if (context.operation === 'set') {
      const value = context.value;

      // Check required structure
      if (!value || typeof value !== 'object') {
        throw new Error('Value must be an object');
      }

      // Validate specific fields
      if (value.email && !isValidEmail(value.email)) {
        throw new Error('Invalid email format');
      }

      if (value.age && (value.age < 0 || value.age > 150)) {
        throw new Error('Invalid age');
      }
    }
  }
));
```

---

## Expiration Middleware

Automatically expires and removes stale data based on TTL or absolute expiration time.

### Import

```javascript
import { expiration } from 'vault-storage/middlewares';
```

### Signature

```typescript
function expiration(options?: ExpirationOptions): Middleware
```

### Parameters

**`options?: ExpirationOptions`**

```typescript
{
  cleanupStrategy?: 'immediate' | 'background' | 'hybrid' | 'proactive';
  cleanupInterval?: number;     // Interval in ms (for background strategies)
  defaultTTL?: number;          // Default TTL in ms
  onExpire?: (key: string) => void;  // Callback when item expires
}
```

### Cleanup Strategies

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| `immediate` | Checks expiration on every `getItem` | Low traffic, simple needs |
| `background` | Periodic background cleanup worker | High traffic, many items |
| `hybrid` | Combines immediate + background | Balanced approach (recommended) |
| `proactive` | Aggressive background cleanup with health monitoring | High churn, critical cleanup |

### Usage Examples

#### Basic Expiration (Immediate Strategy)

```javascript
import Vault from 'vault-storage/vault';
import { expiration } from 'vault-storage/middlewares';

const vault = new Vault('cache');

vault.use(expiration());

// Set item with TTL (time-to-live)
await vault.setItem('temp-data', someData, {
  ttl: 3600000  // Expires in 1 hour (milliseconds)
});

// Or with absolute expiration time
await vault.setItem('session', sessionData, {
  expires: Date.now() + 1800000  // Expires in 30 minutes
});

// Expired items return null
setTimeout(async () => {
  const data = await vault.getItem('temp-data'); // null if expired
}, 3700000);
```

#### Background Cleanup Strategy

```javascript
vault.use(expiration({
  cleanupStrategy: 'background',
  cleanupInterval: 60000  // Clean up every minute
}));

// Items are cleaned up in the background
// getItem doesn't need to check expiration each time
```

#### Hybrid Strategy (Recommended)

```javascript
vault.use(expiration({
  cleanupStrategy: 'hybrid',
  cleanupInterval: 300000  // Background cleanup every 5 minutes
}));

// Best of both worlds:
// - Immediate check on getItem
// - Periodic background cleanup
```

#### Proactive Strategy

```javascript
vault.use(expiration({
  cleanupStrategy: 'proactive',
  cleanupInterval: 30000  // Aggressive cleanup every 30 seconds
}));

// For high-churn scenarios with many expiring items
// Includes worker health monitoring
```

#### Default TTL

```javascript
vault.use(expiration({
  defaultTTL: 3600000  // All items expire in 1 hour by default
}));

// Items automatically get TTL if not specified
await vault.setItem('key', 'value');  // Auto-expires in 1 hour

// Override default
await vault.setItem('persistent', 'value', {
  ttl: 86400000  // 24 hours
});
```

#### Expiration Callback

```javascript
vault.use(expiration({
  cleanupStrategy: 'background',
  onExpire: (key) => {
    console.log(`Item expired: ${key}`);
    // Perform cleanup actions
    logExpiration(key);
    notifyUser(key);
  }
}));
```

#### Combined with Events

```javascript
vault.use(expiration({
  cleanupStrategy: 'hybrid'
}));

vault.on('delete', (event) => {
  console.log(`Item removed: ${event.detail.key}`);
  // Fired when expired items are cleaned up
});

await vault.setItem('temp', 'data', { ttl: 1000 });
// After 1 second, 'delete' event will fire
```

---

## Creating Custom Middleware

You can create your own middleware to extend Vault functionality.

### Middleware Interface

```typescript
interface Middleware {
  name: string;

  // Called before the operation
  before?(context: MiddlewareContext, next: () => Promise<any>): Promise<any>;

  // Called after successful operation
  after?(context: MiddlewareContext, result: any, next: (result: any) => Promise<any>): Promise<any>;

  // Called on errors
  error?(context: MiddlewareContext, error: Error): Promise<Error | void>;

  // Called when middleware is registered
  onRegister?(vault: Vault): void;
}

interface MiddlewareContext {
  operation: 'get' | 'set' | 'remove' | 'clear' | 'keys' | 'length' | 'getItemMeta';
  key?: string;
  value?: any;
  meta?: any;
  vaultInstance?: Vault;
  fromCache?: boolean;
  previousValue?: any;
  previousMeta?: any;
}
```

### Example: Logging Middleware

```javascript
function loggingMiddleware(options = {}) {
  return {
    name: 'logging',

    async before(context, next) {
      console.log(`[Before] ${context.operation} on ${context.key}`);
      return await next();
    },

    async after(context, result, next) {
      console.log(`[After] ${context.operation} on ${context.key}`);
      return await next(result);
    },

    async error(context, error) {
      console.error(`[Error] ${context.operation} on ${context.key}:`, error);
      return error;
    }
  };
}

// Use it
vault.use(loggingMiddleware());
```

### Example: Compression Middleware

```javascript
function compressionMiddleware() {
  return {
    name: 'compression',

    async before(context, next) {
      if (context.operation === 'set') {
        // Compress before storing
        const compressed = await compress(context.value);
        context.value = {
          __compressed: true,
          data: compressed
        };
      }
      return await next();
    },

    async after(context, result, next) {
      if (context.operation === 'get' && result) {
        // Decompress after retrieving
        if (result.__compressed) {
          result = await decompress(result.data);
        }
      }
      return await next(result);
    }
  };
}
```

### Example: Audit Trail Middleware

```javascript
function auditMiddleware(auditLog = []) {
  return {
    name: 'audit',

    async after(context, result, next) {
      if (['set', 'remove', 'clear'].includes(context.operation)) {
        auditLog.push({
          operation: context.operation,
          key: context.key,
          timestamp: Date.now(),
          user: getCurrentUser()
        });
      }
      return await next(result);
    }
  };
}
```

---

## Middleware Best Practices

1. **Keep middleware focused** - Each middleware should do one thing well
2. **Call next()** - Always call the next function to continue the chain
3. **Handle errors gracefully** - Don't let middleware crash the vault
4. **Document side effects** - Clearly document what your middleware does
5. **Test thoroughly** - Test with other middleware combinations
6. **Use TypeScript** - Type safety helps catch errors early

## Middleware Order

Middleware is executed in the order it's registered:

```javascript
vault
  .use(validation())   // 1. Validates first
  .use(encryption())   // 2. Then encrypts
  .use(compression()); // 3. Then compresses

// On set: validation → encryption → compression → storage
// On get: storage → decompression → decryption → (validation skipped on get)
```

## See Also

- [Vault API Reference](vault.md)
- [Creating Custom Middleware Guide](../guides/custom-middleware.md)
- [Encryption Guide](../guides/encryption.md)
- [Validation Patterns](../guides/validation.md)
- [Expiration Guide](../guides/expiration.md)
