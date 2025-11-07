# Vault Storage: The Modern Alternative to LocalStorage

**A 1.5KB library that brings encryption, auto-expiration, and middleware architecture to browser storage - without sacrificing the simplicity you love about LocalStorage.**

```javascript
// LocalStorage: Simple, but limited
localStorage.theme = 'dark';
localStorage.user = JSON.stringify({ name: 'John' });

// Vault Storage: Simple, but scalable
vault.theme = 'dark';
vault.user = { name: 'John' }; // No stringify needed

const theme = await vault.theme;
const user = await vault.user;
```

When you're building a web application, choosing your storage layer is an architectural decision. It's not something you retrofit later when problems emerge.

**LocalStorage works.** For small apps, prototypes, and simple key-value needs, it's perfectly adequate. But if you're building an application with any of these requirements:

- **Security**: Storing sensitive data like tokens or user information
- **Scale**: Managing more than a few MB of data
- **Structure**: Working with complex objects, arrays, or typed data
- **Lifecycle**: Automatic expiration and cleanup of stale data
- **Organization**: Multiple isolated storage spaces
- **Extensibility**: Custom validation, compression, or logging

Then you need a storage architecture designed for these needs from day one. Not as a fix, but as a foundation.

**Vault Storage v2.0** is that architecture. It starts as simple as LocalStorage, but it's built to handle production requirements without the technical debt.

## Level 1: Start Simple (Just Like LocalStorage)

If you're coming from LocalStorage, you'll feel right at home:

```javascript
import vault from 'vault-storage';

// Familiar API, but async
vault.theme = 'dark';
const theme = await vault.theme;

// Objects work without JSON.stringify
vault.user = { name: 'John', preferences: {...} };
const user = await vault.user; // Already an object!
```

**That's it.** No configuration, no setup, no learning curve. But you get:
- 📦 IndexedDB capacity (hundreds of MB vs limited 5MB)
- 🎯 Objects, arrays, Dates, Maps—no serialization
- ⚡ Async operations that don't block UI
- 🔄 Better than LocalStorage, same simplicity

**Sound good? That's level 1.** Most apps can stop here. But when you need more...

## Level 2: Add Encryption (One Line)

Your security team says: "Don't store tokens in LocalStorage—it's not secure."

With Vault, adding encryption is trivial:

```javascript
import { EncryptedVault } from 'vault-storage/encrypted-vault';

const authVault = new EncryptedVault('auth', {
  password: 'your-secret-key-here'
});

// Everything is automatically encrypted with AES-256-GCM
authVault.token = 'secret-jwt-token';
authVault.apiKey = 'sk-...';

// Getting values back
const token = await authVault.token;
```

No crypto library. No manual encrypt/decrypt. No security mistakes. The Web Crypto API handles everything under the hood.

**Check DevTools now:** All encrypted. Your security team is happy.

## Level 3: Add Auto-Expiration (When You Need It)

Cache is growing. Old data piling up. You need TTLs but don't want to rewrite everything:

```javascript
import { Vault } from 'vault-storage/vault';
import { createExpiration } from 'vault-storage/middlewares';

const vault = new Vault('my-app', {
  middlewares: [
    createExpiration({ defaultTTL: '24h' })
  ]
});

// Set with custom TTL
await vault.setItem('session', data, { ttl: '1h' });

// Or use default
await vault.setItem('cache', response); // Expires in 24h
```

Old data automatically disappears. No cleanup scripts. No memory leaks. Just works.

## Level 4: Combine Everything (The Power User)

const authVault = new EncryptedVault({
  password: 'your-secret-key',
  salt: 'your-unique-salt'
});

// Data is encrypted before it touches IndexedDB
authVault.session = {
  token: 'super-secret-jwt',
  userId: 12345,
  permissions: ['admin', 'editor']
};

// Decrypted automatically when you need it
const session = await authVault.session;
```

Using the Web Crypto API under the hood. AES-GCM encryption. Proper key derivation. Your security team can finally sleep at night.

### Data That Knows When to Leave

```javascript
import { expirationMiddleware } from 'vault-storage/middlewares';

vault.use(expirationMiddleware({
  cleanupStrategy: 'background' // or 'immediate', 'hybrid', 'proactive'
}));

// Cache API response for 1 hour
await vault.setItem('api-cache', data, {
  ttl: 3600000 // milliseconds
});

// It's automatically gone after an hour
// No manual cleanup. No stale data. No memory leaks.
```

Set it and forget it. Vault Storage handles the cleanup.

### Middleware: Because One Size Doesn't Fit All

```javascript
// Validate data before it's stored
vault.use(validationMiddleware({
  validator: (key, value) => {
    if (key === 'email' && !value.includes('@')) {
      throw new Error('Invalid email format');
    }
    return true;
  }
}));

// Layer multiple middlewares
vault
  .use(validationMiddleware({ /* ... */ }))
  .use(encryptionMiddleware({ /* ... */ }))
  .use(expirationMiddleware({ /* ... */ }));
```

Composable, testable, predictable. Build the storage layer your app actually needs.

## Real-World Wins

### Before: The LocalStorage Nightmare

```javascript
// The old way 😢
function saveUserPreferences(prefs) {
  try {
    const existing = localStorage.getItem('user_prefs');
    const parsed = existing ? JSON.parse(existing) : {};
    const updated = { ...parsed, ...prefs };
    localStorage.setItem('user_prefs', JSON.stringify(updated));
    localStorage.setItem('user_prefs_timestamp', Date.now().toString());
  } catch (e) {
    console.error('Storage failed:', e);
    // Now what? 🤷
  }
}

function getUserPreferences() {
  try {
    const prefs = localStorage.getItem('user_prefs');
    const timestamp = localStorage.getItem('user_prefs_timestamp');

    // Manual expiration check
    if (timestamp && Date.now() - parseInt(timestamp) > 86400000) {
      localStorage.removeItem('user_prefs');
      localStorage.removeItem('user_prefs_timestamp');
      return null;
    }

    return prefs ? JSON.parse(prefs) : null;
  } catch (e) {
    console.error('Retrieval failed:', e);
    return null;
  }
}
```

### After: The Vault Storage Way

```javascript
// The new way 😎
import vault from 'vault-storage';
import { expirationMiddleware } from 'vault-storage/middlewares';

vault.use(expirationMiddleware());

async function saveUserPreferences(prefs) {
  vault.user_prefs = prefs;
  vault.setMeta('user_prefs', { ttl: 86400000 }); // 24 hours
}

async function getUserPreferences() {
  return await vault.user_prefs;
  // That's it. Seriously.
}
```

From 30 lines of error-prone code to 3 lines of clarity.

### Multi-Tenant Applications

```javascript
// Separate storage per user/context
import Vault from 'vault-storage/vault';

class StorageManager {
  constructor() {
    this.vaults = new Map();
  }

  getVaultForUser(userId) {
    if (!this.vaults.has(userId)) {
      this.vaults.set(userId, new Vault(`user-${userId}`));
    }
    return this.vaults.get(userId);
  }
}

const manager = new StorageManager();
const userVault = manager.getVaultForUser(12345);

// Complete isolation. Zero conflicts.
userVault.preferences = userPrefs;
const prefs = await userVault.preferences;
```

### Offline-First Applications

```javascript
import { Vault } from 'vault-storage/vault';
import { createExpiration } from 'vault-storage/middlewares';

const cache = new Vault('api-cache', {
  middlewares: [createExpiration({ defaultTTL: '5m' })]
});

// Fetch with automatic caching and offline support
async function fetchWithCache(url) {
  // Try cache first (works offline)
  const cached = await cache[url];
  if (cached) {
    return cached;
  }

  try {
    // Online: fetch fresh data
    const response = await fetch(url);
    const data = await response.json();

    // Cache it for next time
    cache[url] = data;
    return data;
  } catch (error) {
    // Offline: return null or throw
    console.warn('Offline and no cache available');
    return null;
  }
}

// State restoration after page reload
async function initializeApp() {
  // Restore user session
  const session = await vault.session;
  if (session) {
    app.user = session.user;
    app.isAuthenticated = true;
  }

  // Restore UI state
  const uiState = await vault.uiState;
  if (uiState) {
    app.theme = uiState.theme || 'light';
    app.sidebarOpen = uiState.sidebarOpen ?? true;
    app.lastRoute = uiState.lastRoute || '/';
  }

  // Restore draft data
  const drafts = await vault.drafts;
  if (drafts) {
    app.unsavedChanges = drafts;
  }
}

// Save state before unload
window.addEventListener('beforeunload', async () => {
  vault.uiState = {
    theme: app.theme,
    sidebarOpen: app.sidebarOpen,
    lastRoute: router.currentRoute
  };
});
```

## The Numbers That Matter

| Feature | Vault Storage v2.0 | LocalStorage |
|---------|-------------------|--------------|
| **Size** | ~1.5KB gzipped | 0KB (built-in) |
| **Capacity** | ~250MB+ (browser-dependent) | 5-10MB |
| **Data Types** | Native objects, arrays, anything | Strings only |
| **Encryption** | Built-in AES-GCM | None |
| **Async** | ✓ Non-blocking | ✗ Blocks UI thread |
| **Expiration** | Automatic with 4 strategies | Manual only |
| **Events** | ✓ Built-in | Limited |
| **TypeScript** | ✓ Full support | Basic |
| **Validation** | ✓ Middleware-based | None |

## Getting Started Takes 60 Seconds

**1. Install it:**
```bash
npm install vault-storage
```

**2. Use it:**
```javascript
import vault from 'vault-storage';

// That's it. You're done.
vault.user = { name: 'John', role: 'admin' };
const user = await vault.user;
```

**3. Level up (optional):**
```javascript
import EncryptedVault from 'vault-storage/encrypted-vault';
import { expirationMiddleware, validationMiddleware } from 'vault-storage/middlewares';

const secureVault = new EncryptedVault({
  password: 'your-secret-key',
  salt: 'your-unique-salt'
});

secureVault
  .use(validationMiddleware({ /* rules */ }))
  .use(expirationMiddleware({ cleanupStrategy: 'hybrid' }));

// Production-ready storage in 10 lines
```

## Why v2.0 Changes Everything

This isn't an incremental update. Version 2.0 is a complete reimagining:

**Middleware Architecture**
Like Express.js, but for storage. Compose functionality exactly how you need it.

**EncryptedVault Class**
Security by default. No configuration paralysis.

**Smart Expiration**
Four cleanup strategies (immediate, background, hybrid, proactive) to match your performance needs.

**Event System**
React to storage changes across your app. Build reactive features without Redux.

**350+ Tests**
Battle-tested. Edge cases covered. Production-ready.

**Zero Dependencies**
No supply chain risks. No bloat. Just 1.5KB of focused functionality.

## The Bottom Line

LocalStorage was great... in 2010. But web applications have evolved. User expectations have evolved. Security requirements have evolved.

Your storage layer should evolve too.

Vault Storage v2.0 gives you:
- The simplicity you love about LocalStorage
- The power you need for modern apps
- The security your users deserve
- The performance your UX demands

At 1.5KB, it's smaller than your favicon. But it'll save you hours of debugging, prevent security incidents, and make your code cleaner.

**Try it for one feature.** Just one. See how it feels to write storage code that doesn't make you cringe.

I think you'll forget all about LocalStorage.

---

**Ready to upgrade your storage game?**

📦 **Install:** `npm install vault-storage`
📖 **Docs:** [github.com/maniartech/vault](https://github.com/maniartech/vault)
⭐ **Star:** If it saves you even one debugging session, we'd love a star on GitHub

Happy coding! 🚀
