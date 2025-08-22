/**
 * Proxy handler powering property-style access for Vault and EncryptedVault.
 *
 * Scope
 * - This handler is generic and NOT encryption-specific. It's used by the base `Vault`
 *   as well as `EncryptedVault` (and any subclass that returns a proxy), to provide
 *   ergonomic property-style reads/writes over an async storage API.
 *
 * Goals
 * - Ergonomic property-style reads/writes over an async storage API.
 * - Keep method API (getItem/setItem/removeItem/clear/getItemMeta/keys/length) consistent
 *   with property-style behavior when operations happen close together in time.
 * - Eliminate read-after-write races that can occur when using a Proxy with async IO.
 *
 * Concurrency model (per-key pending queue)
 * - We maintain a per-instance hidden map of pending operations keyed by property name.
 * - A property write (vault.foo = value) records a pending promise for 'foo'.
 * - A property read (await vault.foo) first returns that pending promise (resolving to
 *   the written value), or, if no pending exists, falls back to vault.getItem('foo').
 * - Method calls are wrapped so they also respect pending operations:
 *   - getItem/getItemMeta wait for any pending op on the key before reading.
 *   - setItem/removeItem chain after any prior pending op for that key and register
 *     their own pending promise.
 *   - clear waits for all pending ops to settle before clearing and then resets state.
 *   - keys/length wait for any pending writes/deletes (and pending clear) to settle
 *     before enumerating/counting, so list/size reflects a consistent view.
 *
 * Clear coordination (latest fix)
 * - When clear() is invoked, a hidden "pending clear" promise is exposed on the instance.
 * - Property reads will defer until the pending clear completes, ensuring reads after
 *   clear() (even if not awaited) observe the cleared state.
 * - Property writes/deletes started during a pending clear are queued to run after the
 *   clear completes, preserving operation ordering and consistency.
 * - keys() and length also wait on the pending clear plus any per-key pending ops to
 *   present a consistent snapshot of the store.
 *
 * Notable behaviors
 * - Function values assigned via property-style (e.g., Jasmine spies) are NOT persisted;
 *   they are attached to the instance to avoid DataCloneError in IndexedDB.
 * - If a property name exists on the instance (methods/fields), we do not treat it as a
 *   storage key; normal JS property semantics apply.
 * - Return values for Proxy traps follow the spec: set/deleteProperty return boolean.
 * - Symbol keys are supported in the pending map but are not persisted to storage; only
 *   string keys should be used for storage access.
 * - The hidden pending map and pending clear promise are non-enumerable to avoid leaking
 *   into user code and JSON.
 *
 * Usage examples
 * - With Vault (no encryption):
 *     const vault = new Vault();
 *     vault.message = 'hi';              // async write starts
 *     console.log(await vault.message);  // 'hi' (no race)
 *     await vault.setItem('x', 1);
 *     console.log(await vault.x);        // 1
 *
 * - With EncryptedVault (encryption is applied by middleware, proxy semantics unchanged):
 *     const ev = new EncryptedVault({ encConfig: { password: 'p', salt: 's' } });
 *     ev.secret = 'top';                 // async write starts, goes through encryption
 *     console.log(await ev.secret);      // 'top' (decrypted on read)
 *
 * - Clear sequencing example:
 *     vault.a = 1;              // async write (pending)
 *     const cp = vault.clear(); // start clear; a pending clear is recorded
 *     console.log(await vault.a); // null; read defers until clear and reflects cleared state
 *     await cp;                  // clear finished
 */
// Track pending async operations triggered via property-style access
type PendingMap = Map<string | symbol, Promise<any>>;

function ensurePending(target: any): PendingMap {
  if (!target.__pendingOps) {
    Object.defineProperty(target, '__pendingOps', {
      value: new Map(),
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  return target.__pendingOps as PendingMap;
}

function getPendingClear(target: any): Promise<any> | undefined {
  return target.__pendingClear as Promise<any> | undefined;
}

function setPendingClear(target: any, p: Promise<any>) {
  Object.defineProperty(target, '__pendingClear', {
    value: p,
    enumerable: false,
    configurable: true,
    writable: true
  });
}

const proxyHandler = {
  /**
   * Property read trap.
   * - If reading an existing instance member, return it (binding functions).
   * - Otherwise, coordinate with pending writes/deletes and delegate to getItem.
   */
  get(target: any, key: string | symbol) {
    // If it's an existing property or method, return it (bind methods to target)
    if (key in target) {
      const member = (target as any)[key];
      if (typeof member === 'function') {
        const pendingMap = ensurePending(target);
        // Wrap specific async methods to coordinate with pending ops
        if (key === 'getItem') {
          return async (k: string) => {
            const pc = getPendingClear(target);
            if (pc) await pc; // prioritize clear
            const p = pendingMap.get(k);
            if (p) await p; // wait for pending write/delete to settle first
            return member.call(target, k);
          };
        }
        if (key === 'getItemMeta') {
          return async (k: string) => {
            const pc = getPendingClear(target);
            if (pc) await pc;
            const p = pendingMap.get(k);
            if (p) await p;
            return member.call(target, k);
          };
        }
        if (key === 'removeItem') {
          return async (k: string) => {
            const pc = getPendingClear(target);
            if (pc) await pc;
            const prior = pendingMap.get(k);
            if (prior) await prior;
            // Call the real method and capture its result (void on success, null on suppression)
            const core = Promise.resolve(member.call(target, k));
            // For pending map consumers, resolve to null when deletion completes
            const op = core
              .then(() => null)
              .catch(() => undefined) // swallow rejection to avoid unhandled promise
              .finally(() => pendingMap.delete(k));
            pendingMap.set(k, op);
            // Return the underlying result
            return await core;
          };
        }
        if (key === 'setItem') {
          return async (k: string, v: any, meta?: any) => {
            // Chain after any prior pending operation for that key
            const pc = getPendingClear(target);
            const prior = pc ? pc.then(() => undefined) : (pendingMap.get(k) || Promise.resolve());
            // Execute the real call (resolves to void on success or null on suppression)
            const core = prior.then(() => member.call(target, k, v, meta));
            // For pending map consumers (e.g., property reads), resolve to the value written
            const op = core
              .then(() => v)
              .catch(() => undefined) // swallow rejection to avoid unhandled promise
              .finally(() => pendingMap.delete(k));
            pendingMap.set(k, op);
            // Return the underlying result to callers of setItem
            return await core;
          };
        }
        if (key === 'clear') {
          return async (...args: any[]) => {
            // Wait for all pending ops to settle, then clear; expose as pending clear
            const clearPromise = (async () => {
              await Promise.all([...pendingMap.values()].map(p => p.catch(() => undefined)));
              try {
                // Forward any arguments (e.g., confirmation options) to the underlying clear
                return await member.apply(target, args);
              } finally {
                pendingMap.clear();
                // clear completed
                try { delete (target as any).__pendingClear; } catch {}
              }
            })();
            setPendingClear(target, clearPromise);
            return clearPromise;
          };
        }
        if (key === 'keys' || key === 'length') {
          return async (...args: any[]) => {
            const pc = getPendingClear(target);
            if (pc) await pc;
            // Wait for all pending writes/deletes to settle before listing/counting
            await Promise.all([...pendingMap.values()].map(p => p.catch(() => undefined)));
            return member.apply(target, args);
          };
        }
        // Default: bind function to instance
        return member.bind(target);
      }
      return member;
    }

    // If a pending write/delete exists for this key, return that promise first
    const pc = getPendingClear(target);
    if (pc) {
      // After clear finishes, read from storage
      return pc.then(() => (target as any).getItem(key as string));
    }
    const pending = (ensurePending(target)).get(key);
    if (pending) return pending;

    // Otherwise, delegate to storage get
    return (target as any).getItem(key as string);
  },
  /**
   * Property write trap.
   * - If writing to an existing instance member, set directly.
   * - If writing a function value, set directly (avoid persisting functions).
   * - Otherwise, start an async setItem and store a pending promise for the key.
   *   Returns true immediately per Proxy contract; consumers should await via
   *   property read or method call to observe completion.
   */
  set(target: any, key: string | symbol, value: any) {
    // If property exists on instance, set it directly (do not persist)
    if (key in target) {
      (target as any)[key] = value;
      return true;
    }
    // Do not persist functions (e.g., Jasmine spies); set on instance to avoid DataCloneError
    if (typeof value === 'function') {
      (target as any)[key] = value;
      return true;
    }
    // Otherwise persist as an item and register a pending promise for consistency
  const pendingMap = ensurePending(target);
  const pc = getPendingClear(target);
  const p = (pc ? pc.then(() => (target as any).setItem(key as string, value))
          : (target as any).setItem(key as string, value))
      .then(() => value)
      .catch(() => undefined) // swallow rejection from failing setItem
      .finally(() => {
        // Clear once settled to avoid stale promises
        pendingMap.delete(key);
      });
    pendingMap.set(key, p);
    // Per Proxy spec, return boolean to indicate success
    return true;
  },
  /**
   * Property delete trap.
   * - If deleting an existing instance member, delete directly.
   * - Otherwise, start an async removeItem and record a pending promise.
   */
  deleteProperty(target: any, key: string | symbol) {
    // If property exists on instance, delete it directly
    if (key in target) {
      // Deleting class properties like methods is not typical, but honor the contract
      delete (target as any)[key];
      return true;
    }
    // Otherwise remove from storage and track pending deletion
  const pendingMap = ensurePending(target);
  const pc = getPendingClear(target);
  const p = (pc ? pc.then(() => (target as any).removeItem(key as string))
          : (target as any).removeItem(key as string))
      .then(() => null)
      .catch(() => undefined) // swallow rejection from failing removeItem
      .finally(() => {
        pendingMap.delete(key);
      });
    pendingMap.set(key, p);
    return true;
  }
}

export default proxyHandler
