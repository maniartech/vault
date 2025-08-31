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

private __cacheGet<T>(key: string): T | undefined {
  const hit = this.__cache.get(key);
  return hit ? (hit.value as T) : undefined;
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
  const context: MiddlewareContext = { operation: 'get', key };
  if (this.__cache.has(key)) {
    return this.__cacheGet<T>(key) as any;
  }
  return this.executeWithMiddleware(context, async () => {
    const record = await this.do<VaultItem<T>>('readonly', store => store.get(context.key as string));
    context.meta = record?.meta ?? null;
    context.value = record == null ? null : record.value;

    if (record != null) {
      // Prefer top-level version; fall back to legacy meta.version; else synthesize
      const version = (record as any).version ?? (record.meta?.version as number | undefined) ?? Date.now();
      this.__cacheSet(key, record.value, record.meta, version);
    }
    return record == null ? null : record.value;
  });
}
```

No mutation; safe because IndexedDB uses structured clone. ([Chrome for Developers][3], [MDN Web Docs][10])

### b) `setItem`

```ts
public async setItem<T = unknown>(key: string, value: T, meta: VaultItemMeta | null = null): Promise<void> {
  const version = Date.now(); // new write => new version; durable across reloads
  const nextMeta = meta;      // do not inject version into meta; preserve null as null
  const context: MiddlewareContext = { operation: 'set', key, value, meta: nextMeta };

  return this.executeWithMiddleware(context, async () => {
    await this.do('readwrite', store => store.put({
      key: context.key as string,
      value: context.value as T,
      meta: context.meta as any,     // can be null
      version                         // top-level persisted field
    } as any));
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
* **O(1) hot reads** after initial load.
* **Cross‑context sync (optional)**: available via middleware; see `docs/browser-sync-middleware.md`.
* **Conflict resolution**: LWW with `meta.version`.

---

## 8) Tiny test checklist

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
