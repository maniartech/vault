Great call—making cross-context sync opt-in via middleware keeps the core lean and lets you run synced and unsynced Vaults side-by-side.

This adds a focused, runtime-agnostic Sync middleware section that aligns with your existing middleware types and the proposed cache/events additions. It uses native BroadcastChannel in browsers, or an isomorphic implementation in Node/Deno. ([MDN Web Docs][1], [npm][2])

---

TL;DR

- Opt-in sync via middleware; no default broadcasting
- Channel scoped by storageName (and optionally a config hash)
- Broadcast tiny invalidations only: { op, key, version }
- Middleware applies remote changes via an injected applyRemoteChange for LWW + cache coherence
- Works in browsers (BroadcastChannel) and Node/Deno (broadcast-channel)

Prerequisites

- Core events + cache as outlined in docs/update.md (subscribe/subscribeAll, internal bus, cache helpers)
- No core API changes required: the middleware injects a per-instance applyRemoteChange at runtime

---

10) Optional Sync Middleware (opt-in cross-context events)

Goal: enable cross-tab/worker sync only when a middleware is installed. Default remains local-only.

Public surface (no core changes)

The middleware injects a per-instance method at registration time so it can apply remote updates without modifying core:

```ts
// Injected dynamically by middleware on the specific Vault instance
type ApplyRemoteChange = (ev: { op: "set" | "remove" | "clear"; key?: string; version?: number; meta?: any }) => Promise<void> | void;
```

Type shapes used by the middleware (consistent with docs/update.md):

```ts
type ChangeOp = "set" | "remove" | "clear";
type ChangeEvent = { op: ChangeOp; key?: string; meta?: any; version?: number };
```

Middleware factory (aligned with current Middleware interface)

```ts
import type { Middleware, MiddlewareContext } from "../src/types/middleware";

type SyncOptions = {
  channel?: string; // defaults to `vault:<storageName>`
  makeBroadcastChannel?: (name: string) => {
    postMessage: (data: any) => void;
    addEventListener: (t: "message", cb: (e: { data: any }) => void) => void;
    removeEventListener?: (t: "message", cb: any) => void;
    close?: () => void;
  } | null;
  filter?: (ev: ChangeEvent) => boolean; // optional app-level filter (prefix, keyset, etc.)
};

export function syncMiddleware(opts: SyncOptions = {}): Middleware {
  const SELF = `${Date.now()}-${Math.random().toString(36).slice(2)}`; // echo guard
  let bc: ReturnType<NonNullable<SyncOptions["makeBroadcastChannel"]>> | BroadcastChannel | null = null;
  let onMessage: ((e: { data: ChangeEvent & { __source?: string } }) => void) | null = null;

  const makeBC = opts.makeBroadcastChannel ?? ((name: string) =>
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(name) : null);

  return {
    name: "sync",

    onRegister(vaultInstance: any) {
      const storageName = (vaultInstance && vaultInstance.storageName) || "default";
      const channelName = opts.channel || `vault:${storageName}`;
      // Inject applyRemoteChange on this instance (keeps core unchanged)
      if (typeof vaultInstance.applyRemoteChange !== "function") {
        vaultInstance.applyRemoteChange = async (ev: ChangeEvent) => {
          try {
            if (ev.key && ev.op === "set") {
              const value = await vaultInstance.getItem(ev.key);
              const meta = (await vaultInstance.getItemMeta?.(ev.key)) ?? null;
              const version = (meta?.version as number) ?? (ev.version ?? Date.now());
              // update cache if present
              if (vaultInstance.__cache?.set) {
                vaultInstance.__cache.set(ev.key, { value, meta, version });
              }
              // notify local subscribers if bus exists
              vaultInstance.__bus?.dispatchEvent?.(new CustomEvent("change", { detail: { op: "set", key: ev.key, meta, version } }));
            } else if (ev.key && ev.op === "remove") {
              vaultInstance.__cache?.delete?.(ev.key);
              vaultInstance.__bus?.dispatchEvent?.(new CustomEvent("change", { detail: ev }));
            } else if (ev.op === "clear") {
              vaultInstance.__cache?.clear?.();
              vaultInstance.__bus?.dispatchEvent?.(new CustomEvent("change", { detail: ev }));
            }
          } catch {
            // best-effort only; ignore if internals aren't available
          }
        } as any;
      }
      bc = makeBC(channelName);
      if (!bc) return; // runtime without BC – middleware becomes a no-op

      onMessage = (e) => {
        const ev = e.data;
        if (!ev || ev.__source === SELF) return; // ignore self
        if (opts.filter && !opts.filter(ev)) return;
        // Apply remotely via the injected helper (no core dependency)
        vaultInstance.applyRemoteChange?.({ op: ev.op, key: ev.key, version: ev.version, meta: ev.meta });
      };
      bc.addEventListener("message", onMessage);
    },

    // Broadcast after successful mutations
    after(context: MiddlewareContext, result: any) {
      if (!bc) return result;
      const op = context.operation;
      if (op === "set" || op === "remove" || op === "clear") {
        const ev: ChangeEvent & { __source: string } = {
          op: op,
          key: context.key,
          meta: context.meta,
          version: (context.meta as any)?.version ?? Date.now(),
          __source: SELF
        } as any;
        bc.postMessage(ev);
      }
      return result;
    },

    // Optional: best-effort cleanup on error (no explicit teardown hook available)
    error(_context, err) {
      // If your app exposes a manual teardown, call bc.close?.() there.
      return err;
    }
  };
}
```

Why this design works

- Opt-in: no cross-context traffic unless the middleware is installed
- Same-origin, real-time fan-out using BroadcastChannel’s message event ([MDN][1])
- Cross-runtime: inject a factory that returns a BC-like object (broadcast-channel) ([npm][2])
- Tiny payloads: broadcast only { op, key, version }; receivers re-read as needed
- Loop prevention via a per-instance SELF token
- LWW via version (ms epoch) under concurrent writes

Channel identity rules (when to sync)

Two instances should exchange events iff all of the following match:

1) Same origin (protocol + host + port) – inherent BC constraint ([MDN][1])
2) Same database identity (storageName passed to new Vault("name"))
3) Optional: same config hash if you need stricter compatibility (e.g., encryption mode/schema). Compute a small stable hash of a canonicalized config subset and append it to the channel name.

Minimal channel name: `vault:<storageName>`

Strict channel name (example):

```
vault:<origin>|<dbName>|<driverId>|<schemaVersion>|<sha256(JCS(configSubset))>
```

Usage examples

```ts
// Unsynced vault
const localOnly = new Vault("local");

// Synced vault (browser, native BroadcastChannel)
const synced = new Vault("shared").use(syncMiddleware());

// Synced vault (Node/Deno/Electron)
import { BroadcastChannel as BC } from "broadcast-channel";
const crossRuntimeSynced = new Vault("team").use(
  syncMiddleware({ makeBroadcastChannel: (name) => new BC(name) })
);
```

Teardown notes

- Native BroadcastChannel supports bc.close(); call it from your app’s lifecycle if needed
- The current Middleware interface has no explicit teardown hook; you can export a factory that returns both middleware and a close() function, or perform cleanup from your application shell

References and compatibility

- BroadcastChannel: same-origin, message event, close() ([MDN][1])
- IndexedDB + structured clone (safe to re-read values) ([MDN][4])
- broadcast-channel package for non-browser runtimes ([npm][2], [GitHub][3])

---

Bottom line

Keep sync transportation purely in middleware, scope by storageName (and optionally config hash), broadcast tiny invalidations, and apply via Vault.applyRemoteChange to keep caches coherent across tabs without coupling the core.

[1]: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel?utm_source=chatgpt.com "BroadcastChannel - MDN - Mozilla"
[2]: https://www.npmjs.com/package/broadcast-channel?utm_source=chatgpt.com "broadcast-channel"
[3]: https://github.com/pubkey/broadcast-channel?utm_source=chatgpt.com "GitHub - pubkey/broadcast-channel"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API?utm_source=chatgpt.com "IndexedDB API - MDN - Mozilla"
