# Migration Guide: v1.x → v2.0

This guide helps you upgrade from Vault Storage v1.x (up to 1.3.4) to v2.0.

- v2.0 focuses on a clean core `Vault`, a ready-to-use `EncryptedVault`, and a powerful middleware system (encryption, validation, expiration).
- Tests and API surface are stable; bundle sizes are small (~1.5–3KB gz for primary builds).

## TL;DR

- Use `EncryptedVault` instead of any legacy “SecuredVault” concept.
- Import focused entry points (tree-shake friendly):
  - `vault-storage/vault`
  - `vault-storage/encrypted-vault`
  - `vault-storage/middlewares/*`
- Middlewares are attached via `vault.use(mw)`.
- Events are standard `EventTarget` + an `onchange` convenience property.

## Installation

No change. The package name remains:

```bash
npm install vault-storage
```

## Imports and entry points

v1.x often used the root entry for everything. In v2.0, prefer specific paths:

```ts
// v1.x (example)
import { Vault /*, SecuredVault */ } from 'vault-storage';

// v2.0
import Vault from 'vault-storage/vault';
import EncryptedVault from 'vault-storage/encrypted-vault';
import { encryption, validation, expiration } from 'vault-storage/middlewares';
```

You can still use the root `index` builds for convenience:

```ts
import * as VaultStorage from 'vault-storage';
// VaultStorage.Vault, VaultStorage.EncryptedVault, VaultStorage.middlewares...
```

## Replacing SecuredVault with EncryptedVault

v1.x had a notion of “SecuredVault” options/types. In v2.0 this is replaced with `EncryptedVault` and the encryption middleware:

```ts
// v1.x (conceptual)
// new SecuredVault({ password, salt, ... })

// v2.0
import EncryptedVault from 'vault-storage/encrypted-vault';

const vault = new EncryptedVault({ password: 'secret', salt: 'user-id' });
await vault.setItem('key', 'value');
```

Advanced: provide credentials per key and optionally skip encryption for selected keys by returning `null` from the provider:

```ts
const vault = new EncryptedVault(async (key) => {
  if (key.startsWith('public:')) return null; // store as plain JSON
  return { password: session.password, salt: session.userId };
});
```

## Middleware usage (encryption, validation, expiration)

In v2.0, middleware is the primary extension mechanism:

```ts
import Vault from 'vault-storage/vault';
import { encryption, validation, expiration } from 'vault-storage/middlewares';

const vault = new Vault();
vault
  .use(validation({ /* rules */ }))
  .use(expiration({ defaultTTL: '7d' }))
  .use(encryption({ password: 'p', salt: 's' }));
```

`EncryptedVault` is just a `Vault` with `encryption` pre-applied:

```ts
import EncryptedVault from 'vault-storage/encrypted-vault';
const vault = new EncryptedVault({ password: 'p', salt: 's' });
```

## Events

v2.0 uses `EventTarget` under the hood:

```ts
const vault = new Vault();

vault.addEventListener('change', (ev) => {
  console.log('changed:', ev.detail);
});

// or
vault.onchange = (ev) => {
  console.log('changed:', ev.detail);
};
```

`detail` typically includes `{ operation, key, value, meta, prevValue }` depending on the operation and middleware.

## Type changes

- Removed legacy `SecuredVaultOptions` and related types.
- Encryption types live under `vault-storage/types`:
  - `EncryptionCredential` — `{ password: string; salt: string }`
  - `EncryptionCredentialProvider` — `(key: string) => Promise<EncryptionCredential | null>`
  - `EncryptionConfig` — union of the above or `null` (to disable encryption)

## Breaking changes checklist

- SecuredVault removed — use `EncryptedVault` instead.
- Import paths shifted to focused entry points for better tree-shaking.
- Middleware-first design; pass behaviors via `use()` instead of constructor flags.
- Event system standardized on `EventTarget` with `onchange` convenience.

## Migration examples

### Basic data flow (no encryption)

```ts
// v1.x
import { Vault } from 'vault-storage';
const vault = new Vault();
await vault.setItem('k', { n: 1 });
const v = await vault.getItem('k');

// v2.0 (unchanged for basic use)
import Vault from 'vault-storage/vault';
const vault2 = new Vault();
await vault2.setItem('k', { n: 1 });
const v2 = await vault2.getItem('k');
```

### Encrypted storage

```ts
// v1.x (SecuredVault-ish)
// const vault = new SecuredVault({ password, salt })

// v2.0
import EncryptedVault from 'vault-storage/encrypted-vault';
const vault = new EncryptedVault({ password, salt });
```

### Per-key encryption policy

```ts
const vault = new EncryptedVault(async (key) => {
  if (key.startsWith('public:')) return null; // store as plain JSON
  return { password: session.password, salt: session.userId };
});
```

## FAQ

- Why did you remove SecuredVault?
  To simplify the surface and make middleware the single extension mechanism. `EncryptedVault` remains for convenience.

- Is v2 compatible with my data from v1?
  JSON values remain compatible. If you used a custom secured/encrypted format, migrate those keys using a one-time read + write with `EncryptedVault`.

- What are the default crypto settings?
  AES-GCM (256-bit) with keys derived via PBKDF2 (SHA-256, 100k iterations). You can tune iterations via options.

## See also

- API: [Vault](../api/vault.md)
- API: [EncryptedVault](../api/encrypted-vault.md)
- API: [Middlewares](../api/middlewares.md)
