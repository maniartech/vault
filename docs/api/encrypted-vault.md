# EncryptedVault API

EncryptedVault is a preconfigured Vault with the encryption middleware applied automatically. All values written are transparently encrypted and all values read are transparently decrypted.

- Package entry: `vault-storage/encrypted-vault`
- Class: `EncryptedVault`
- Extends: `Vault`

## Constructor

new EncryptedVault(config, options?)

- config: `EncryptionConfig`
  - `EncryptionCredential`: `{ password: string; salt: string }`
  - `EncryptionCredentialProvider`: `(key: string) => Promise<EncryptionCredential | null>`
  - `null`: disables encryption (acts like regular Vault)
- options?: `EncryptedVaultOptions`
  - `storageName?`: string — database name (default: "encrypted-vault-storage")
  - `keyDerivationIterations?`: number — PBKDF2 iterations (default: 100000)
  - `maxCachedKeys?`: number — cache size for derived keys (default: 100; set 0 to disable)

Returns: EncryptedVault instance (a Proxy-wrapped Vault)

### Example: password + salt

```ts
import EncryptedVault from 'vault-storage/encrypted-vault';

const vault = new EncryptedVault(
  // config: credentials for key derivation
  { password: 'strong-password', salt: 'user-specific-salt' },
  // options: storage and crypto tuning
  { storageName: 'app-secure', keyDerivationIterations: 150_000 }
);

await vault.setItem('profile', { name: 'Aamir' });
const profile = await vault.getItem('profile'); // { name: 'Aamir' }
```

### Example: credential provider per key

Use a provider to return different credentials by key, or return `null` to skip encryption for a specific key.

```ts
const vault = new EncryptedVault(async (key) => {
  if (key.startsWith('public:')) return null; // no encryption
  return { password: session.password, salt: session.userId };
});

await vault.setItem('public:theme', 'dark');        // stored as plain JSON
await vault.setItem('private:token', 'secret-token'); // stored encrypted
```

## Methods (inherited from Vault)

EncryptedVault inherits the full Vault API and behavior:

- `setItem(key: string, value: any, meta?: Record<string, any>): Promise<void>`
- `getItem<T = any>(key: string): Promise<T | null>`
- `removeItem(key: string): Promise<void>`
- `keys(): Promise<string[]>`
- `clear(): Promise<void>`
- `backup(): Promise<BackupSnapshot>`
- `restore(snapshot: BackupSnapshot): Promise<void>`
- `use(middleware: Middleware): this`
- `addEventListener(type, listener)`
- `removeEventListener(type, listener)`
- `onchange?: (ev: VaultChangeEvent) => void`

Note: When the stored item is encrypted, the raw IndexedDB value is wrapped as `{ __encrypted: true, data: number[] }`. This is internal and handled by the middleware.

## Behavior details

- Strings are encrypted as-is and returned as strings.
- Non-JSON numbers like `NaN`, `Infinity`, `-Infinity` are preserved via a small wrapper to round-trip reliably.
- If the credential provider returns `null` for a key, that key is stored unencrypted.
- The middleware uses AES-GCM 256 with keys derived via PBKDF2 (SHA-256).
- Derived keys are cached up to `maxCachedKeys` entries when caching > 0.

## Errors

- `EncryptionError` — thrown if encryption/decryption fails or invalid credentials are supplied. Original error is attached to `error.cause`.

## Security best practices

- Use a user-specific salt, not a constant. A good pattern is hashing the user ID or using a stable random per-user salt.
- Don’t hardcode secrets in source; fetch credentials from a secure source (e.g., login flow, OS keystore, or server-provided secrets).
- Rotate credentials by changing the salt/password and re-encrypting items as needed.
- Consider limiting `maxCachedKeys` or setting it to 0 for highly sensitive contexts.

## Type references

- `EncryptionCredential`, `EncryptionCredentialProvider`, `EncryptionConfig` — `vault-storage/types`
- `EncryptionOptions` (merged into `EncryptedVaultOptions`) — encryption middleware options
