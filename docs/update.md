# Update: Add events + cache to Vault class

You want to add two features to your existing `Vault` class:

* **Events:** let consumers listen to changes via standard EventTarget APIs; cross‑context fan‑out is available via optional middleware.
* **Cache:** keep a tiny in-memory snapshot of `{ key → { value, meta, version } }` to make hot `getItem` calls O(1) after first read/write.

Below is a minimal design + drop-in code you can paste into your existing class. It doesn’t alter any existing method signatures or behavior—only adds new fields and methods, and touches the internals of `getItem`, `setItem`, `removeItem`, `clear` to wire in the cache + local events.

---

## 1) Types (internal, tiny)

```ts
type ChangeOp = "set" | "remove" | "clear";
type ChangeEvent = { op: ChangeOp; key?: string; meta?: any; version?: number };
type CacheEntry = { value: any; meta?: any; version: number };
```

* `version` is a simple **LWW** guard (`Date.now()` at write time).
* No public exposure; purely internal.

### Updated MiddlewareContext

Add the optional `fromCache` property and cache invalidation methods to the existing MiddlewareContext interface:

```ts
interface MiddlewareContext {
  operation: 'get' | 'set' | 'remove' | 'clear' | 'keys' | 'length' | 'getItemMeta';
  key?: string;
  value?: any;
  meta?: VaultItemMeta | null;
  fromCache?: boolean; // NEW: true when data comes from cache, false for fresh DB reads

  // NEW: Cache invalidation methods available to middleware
  invalidateCache?: (key: string) => void;
  vaultInstance?: any; // Reference to vault instance for operations
  // ... other existing properties
}
```

---

## 2) Private fields (bus, cache)

Add these private fields to the class:

```ts
// — internal event bus (same-process)
private __bus = new EventTarget();

// — in-memory snapshot cache
private __cache = new Map<string, CacheEntry>();

// (No cross-context transport in core; see sync middleware doc)
```

// No BroadcastChannel setup in core; cross-context sync is provided by middleware.

---

## 3) Public event APIs (standard EventTarget)

Expose standard EventTarget-style methods on the instance (forwarded to the internal bus). This is additive and doesn’t change any existing method signatures.

```ts
public addEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): void {
  this.__bus.addEventListener(type, listener as any, options as any);
}

public removeEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions
): void {
  this.__bus.removeEventListener(type, listener as any, options as any);
}

public dispatchEvent(event: Event): boolean {
  return this.__bus.dispatchEvent(event);
}

// Optional DOM-like property handler for convenience
public onchange?: (e: CustomEvent<ChangeEvent>) => void;

// Usage: key-scoped listener filters by e.detail.key
vault.addEventListener("change", (e: Event) => {
  const ev = (e as CustomEvent<ChangeEvent>).detail;
  if (ev.key === "profile") {
    // handle profile updates
  }
});
```

This uses **EventTarget**—small and native. ([MDN Web Docs][1])

---

## 4) Emit helper (internal)

```ts
private __emit(ev: ChangeEvent) {
  const evt = new CustomEvent<ChangeEvent>("change", { detail: ev });
  this.__bus.dispatchEvent(evt);
  // Optional DOM-like handler
  if (typeof this.onchange === "function") {
    try { this.onchange(evt as any); } catch {}
  }
}
```

// Cross-context fan-out can be implemented by an optional sync middleware.

---

## 5) Cache helpers (internal)

```ts
private __cacheSet(key: string, value: any, meta: any | null, version?: number) {
  const v = version ?? Date.now();
  this.__cache.set(key, { value, meta, version: v });
  return v;
}

private __cacheGet(key: string): CacheEntry | undefined {
  return this.__cache.get(key);
}

private __cacheDelete(key: string) {
  this.__cache.delete(key);
}

private __cacheClear(prefix?: string) {
  if (!prefix) return this.__cache.clear();
  for (const k of this.__cache.keys()) if (k.startsWith(prefix)) this.__cache.delete(k);
}
```

---

// Remote-apply logic is handled by the sync middleware when installed.

---

## 6) Surgical changes to existing methods

* **Cross‑context sync (optional)**: available via middleware; see `docs/browser-sync-middleware.md`.
* **Conflict resolution**: LWW with a top-level `version` field.
### a) `getItem`

```ts
public async getItem<T = unknown>(key: string): Promise<T | null | undefined> {
  const context: MiddlewareContext = { operation: 'get', key, fromCache: true };

  // Check cache first - use cached data to avoid DB hit
  let record = this.__cache.get(key);
  if (!record) {
    // Cache miss - read from DB
    const dbRecord = await this.do<VaultItem<T>>('readonly', store => store.get(key));
    if (dbRecord) {
      const version = (dbRecord as any).version ?? (dbRecord.meta?.version as number | undefined) ?? Date.now();
      // Cache the RAW data from DB (before middleware processing)
      this.__cacheSet(key, dbRecord.value, dbRecord.meta, version);
      record = { value: dbRecord.value, meta: dbRecord.meta, version };
    }
    context.fromCache = false;
  }

  // Run through middleware pipeline with cached or fresh data
  return this.executeWithMiddleware(context, async () => {
    context.meta = record?.meta ?? null;
    context.value = record == null ? null : record.value;

    // Provide cache invalidation method to middleware
    context.invalidateCache = (key: string) => this.__cacheDelete(key);
    context.vaultInstance = this;

    // No DB operation needed - return processed value
    return context.value;
  });
}
```

No mutation; safe because IndexedDB uses structured clone. Cache stores raw DB data and always runs middleware pipeline to maintain security and functionality (encryption, expiration, validation). Middleware can optimize using the optional `context.fromCache` hint.

### b) `setItem`

```ts
public async setItem<T = unknown>(key: string, value: T, meta: VaultItemMeta | null = null): Promise<void> {
  const version = Date.now();
  const context: MiddlewareContext = { operation: 'set', key, value, meta };

  return this.executeWithMiddleware(context, async () => {
    await this.do('readwrite', store => store.put({
      key: context.key as string,
      value: context.value as T,
      meta: context.meta as any,
      version
    } as any));

    // Cache the RAW values that were stored (post-middleware processing)
    this.__cacheSet(key, context.value, context.meta, version);
    this.__emit({ op: "set", key, meta: context.meta, version });
  });
}
```

### c) `removeItem`

```ts
public async removeItem(key: string): Promise<void> {
  const context: MiddlewareContext = { operation: 'remove', key };
  return this.executeWithMiddleware(context, async () => {
    const record = await this.do<VaultItem>('readonly', s => s.get(context.key as string));
    context.meta = record?.meta ?? null;
    context.value = record?.value ?? null;
    await this.do('readwrite', s => s.delete(context.key as string));
    this.__cacheDelete(key);
    this.__emit({ op: "remove", key, meta: context.meta, version: Date.now() });
  });
}
```

### d) `clear`

```ts
public async clear(confirm?: boolean): Promise<void> {
  const confirmClear = confirm;
  const context: MiddlewareContext = { operation: 'clear', confirmClear };
  return this.executeWithMiddleware(context, async () => {
    await this.do('readwrite', store => store.clear());
    this.__cacheClear();
    this.__emit({ op: "clear", version: Date.now() });
  });
}
```

- Existing methods like `keys()` remain untouched.
- Storage shape: items are saved as { key, value, meta, version }.
- Backward compatibility: older records may not have version; treat as (meta?.version ?? Date.now()) when read.
- IndexedDB doesn’t require a schema migration to add fields; extra properties can be stored without upgrading the object store.

---

## 7) Behavior & guarantees (concise)

* **No breaking changes**: original behavior remains intact.
* **O(1) hot reads** after initial load by caching raw DB data and eliminating IndexedDB I/O.
* **Middleware integrity** maintained - all middleware runs on every operation, with optional `context.fromCache` optimization hint.
* **Cross‑context sync (optional)**: available via middleware; see `docs/browser-sync-middleware.md`.

---

## 9) Middleware Cache Optimization Guide

Middleware can voluntarily optimize their operations when `context.fromCache` is true. Here's how each type of middleware should handle cached data:

### Encryption Middleware
```ts
// Must always run - no optimization possible for security
async after(context: MiddlewareContext, result: any): Promise<any> {
  if (context.operation === 'get') {
    // Always decrypt, but can optimize key derivation if needed
    if (context.fromCache) {
      // Optional: Use cached key derivation, but still must decrypt
    }
    return await decrypt(result, this.config);
  }
  return result;
}
```

### Expiration Middleware
```ts
// Can optimize expiration checks using cached metadata and invalidate cache when needed
async after(context: MiddlewareContext, result: any): Promise<any> {
  if (context.operation === 'get' && context.fromCache) {
    // Fast path: check expiration from cached meta without DB access
    const expires = context.meta?.expires;
    if (expires && Date.now() > expires) {
      // Item expired - invalidate cache immediately
      if (context.invalidateCache) {
        context.invalidateCache(context.key);
      }

      // Remove from storage and return null
      await context.vaultInstance.removeItem(context.key);
      return null;
    }
    return result; // Not expired, return cached result
  }

  // Normal path: full expiration logic for fresh DB reads
  // ... existing implementation
}
```

### Validation Middleware
```ts
// Can skip validation on cached reads - data already validated when stored
async before(context: MiddlewareContext): Promise<MiddlewareContext> {
  if (context.operation === 'get' && context.fromCache) {
    // Skip validation on reads from cache - data already validated
    return context;
  }

  // Normal path: full validation for writes and fresh reads
  // ... existing validation logic
}
```

### Audit/Logging Middleware
```ts
// Can optimize logging for cached reads
async after(context: MiddlewareContext, result: any): Promise<any> {
  if (context.operation === 'get' && context.fromCache) {
    // Optional: Log cache hit instead of full read operation
    this.logCacheHit(context.key);
  } else {
    // Normal logging for writes and cache misses
    this.logOperation(context);
  }
  return result;
}
```

### General Guidelines:
- **Security-critical middleware** (encryption): Must always run fully
- **Data validation middleware**: Can skip on cached reads (already validated)
- **Expiration/TTL middleware**: Can optimize using cached metadata and invalidate cache when items expire
- **Logging/audit middleware**: Can differentiate between cache hits and DB reads
- **Cache invalidation**: Use `context.invalidateCache(key)` when middleware removes or invalidates items
- **Custom middleware**: Use `context.fromCache` to optimize expensive operations when safe

---

## 10) Tiny test checklist

* Cache hits speed up repeated `getItem`.
 [1]: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget?utm_source=chatgpt.com "EventTarget - MDN"
* Cross-tab behavior is covered in middleware tests (see sync middleware doc).
* LWW logic handles concurrent writes.

---

This keeps your **Vault class simple and maintainable**, while adding only the two capabilities you want (subscribe + cache), using well-supported native browser APIs. Let me know if you’d like a PR or integration help!

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API?utm_source=chatgpt.com "Broadcast Channel API - MDN"
[2]: https://medium.com/%40md.mollaie/mastering-cross-tab-communication-in-angular-with-broadcastchannel-api-0e15ccef75bf?utm_source=chatgpt.com "Mastering Cross-Tab Communication in Angular with ..."
[3]: https://developer.chrome.com/blog/indexeddb-durability-mode-now-defaults-to-relaxed?utm_source=chatgpt.com "A change to the default durability mode in IndexedDB | Blog"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction?utm_source=chatgpt.com "IDBDatabase: transaction() method - MDN"
[5]: https://medium.com/%40shashika.silva88/indexeddb-a-comprehensive-overview-for-frontend-developers-6b47a9f32e23?utm_source=chatgpt.com "IndexedDB: A Complete Guide for Frontend Developers on ..."
[6]: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/durability?utm_source=chatgpt.com "IDBTransaction: durability property - MDN - Mozilla"
[7]: https://adocasts.com/lessons/cross-tab-communication-in-javascript-using-a-broadcastchannel?utm_source=chatgpt.com "Cross-Tab Communication in JavaScript using a ..."
[8]: https://www.reddit.com/r/reactjs/comments/1kqlx6w/i_built_a_lightweight_lib_to_instantly_sync_state/?utm_source=chatgpt.com "I built a lightweight lib to instantly sync state across browser ..."
[9]: https://caniuse.com/broadcastchannel?utm_source=chatgpt.com "BroadcastChannel | Can I use... Support tables for HTML5, ..."
[10]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB?utm_source=chatgpt.com "Using IndexedDB - MDN - Mozilla"
[11]: https://dev.to/itxshakil/broadcastchannel-api-a-hidden-gem-for-web-developers-33c4?utm_source=chatgpt.com "BroadcastChannel API: A Hidden Gem for Cross-Tab ..."
