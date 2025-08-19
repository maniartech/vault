# Vault Storage — Universal Runtime Support

This document describes how to run `vault-storage` across browsers (IndexedDB), Node.js, Bun, and Deno by abstracting storage and crypto behind portable adapters.

## Goals

- Keep the browser behavior unchanged (IndexedDB by default)
- Make Node/Bun/Deno work with zero or minimal configuration
- Provide simple persistence choices on servers (in-memory or file/KV backed)
- Keep middlewares (encryption, expiration, validation) working unchanged

## Architecture

### StorageAdapter interface

A small contract lets Vault use any storage backend without knowing about IndexedDB, files, or KV stores.

```ts
export interface StorageAdapter {
  open(name: string): Promise<void>;
  put(key: string, value: any, meta: any | null): Promise<void>;
  get(key: string): Promise<{ key: string; value: any; meta: any | null } | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  count(): Promise<number>;
}
```

### Adapters

- Browser: IndexedDB (default)
- Universal: In-memory (works everywhere)
- Node: File-backed (JSON) or any DB you prefer
- Deno: KV (optional)

> Note: If an adapter isn’t shipped in your build yet, you can drop the snippet into your app or PR it here.

#### IndexedDB (browser)

Uses a single object store named `store` under the vault name. Behavior matches the current implementation.

#### Memory (universal)

A simple `Map<string, { value, meta }>` implementation. Great for tests and server processes where persistence isn’t needed.

#### Node (file)

A tiny JSON file beside your process (e.g. `./<name>.vault.json`) for persistence. Suitable for CLIs, scripts, small services. Swap with a real DB adapter for scale.

#### Deno (KV)

Stores records under the key prefix `['vault', <key>]` using `Deno.openKv()`.

## Crypto portability

Vault’s encryption middleware relies on WebCrypto. To make it work in Node/Bun/Deno as well as browsers, resolve `SubtleCrypto` like this:

```ts
export async function getSubtle(): Promise<SubtleCrypto> {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  try {
    const { webcrypto } = await import('node:crypto');
    return webcrypto.subtle;
  } catch {
    throw new Error('Web Crypto API not available in this environment');
  }
}
```

Then use `const subtle = await getSubtle()` inside your encryption utilities instead of accessing `crypto.subtle` directly.

## Adapter selection

Vault can accept an adapter in its constructor. If omitted, it auto-selects:

- Browser: IndexedDB
- Server runtimes: Memory (safe default)

Example constructor signature:

```ts
new Vault(storageName?: string, adapter?: StorageAdapter)
```

## Usage examples

### Browser (unchanged)

```ts
import Vault from 'vault-storage';
import { expirationMiddleware } from 'vault-storage/middlewares/expiration';

const vault = new Vault('app'); // defaults to IndexedDB
vault.use(expirationMiddleware());
await vault.setItem('k', 'v');
```

### Node (in-memory)

```ts
import Vault from 'vault-storage';
import { MemoryAdapter } from 'vault-storage/adapters/memory';

const vault = new Vault('app', new MemoryAdapter());
await vault.setItem('k', 'v');
```

### Node (file persistence)

```ts
import Vault from 'vault-storage';
import { NodeFsAdapter } from 'vault-storage/adapters/node-fs';

const vault = new Vault('app', new NodeFsAdapter());
```

### Deno (KV)

```ts
import Vault from 'npm:vault-storage';
import { DenoKvAdapter } from './adapters/deno-kv.ts';

const vault = new Vault('app', new DenoKvAdapter());
```

### Bun

Bun supports Node’s `fs` and `crypto` APIs, so you can use the Node adapters:

```ts
import Vault from 'vault-storage';
import { NodeFsAdapter } from 'vault-storage/adapters/node-fs';

const vault = new Vault('app', new NodeFsAdapter());
```

## Migration notes

- Existing browser code needs no changes.
- Server usage should pass an adapter explicitly until auto-detection is finalized in your build.
- If you rely on encryption middleware, ensure `getSubtle()` is used.

## Roadmap

- Provide official adapters in `vault-storage/adapters/*` (memory, node-fs, deno-kv)
- Auto-detect runtime and pick sensible defaults
- Add examples and tests for Node, Bun, and Deno

---

Questions or requests for additional adapters (SQLite, PostgreSQL, Redis)? Open an issue or PR with your preferred storage API and we’ll help wire it up.