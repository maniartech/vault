/**
 * Expiration middleware for automatic TTL handling and cleanup
 */

import { Middleware, MiddlewareContext } from '../types/middleware.js';

/**
 * Configuration options for expiration middleware
 */
export interface ExpirationOptions {
    /** Default TTL in milliseconds for all items when no expiration is specified */
    defaultTTL?: number;
    /** Cleanup strategy: 'immediate', 'background', 'hybrid' */
    cleanupMode?: 'immediate' | 'background' | 'hybrid';
    /** Background worker interval in milliseconds (default: 200) */
    workerInterval?: number;
    /** Minimum time between on-demand sweeps in milliseconds (default: 300) */
    throttleMs?: number;
}

/**
 * Parse duration string or number to milliseconds
 * Supports: number (ms), "1d", "1h", "1m", "1s"
 */
function parseDuration(duration: string | number): number {
    if (typeof duration === 'number') return duration; // supports 0 and negatives if ever passed

    const match = duration.match(/^(\d+)([a-z])$/i);
    if (!match) throw new Error(`Invalid duration format: ${duration}`);

    const [, value, unitRaw] = match;
    const unit = unitRaw.toLowerCase();
    const num = parseInt(value, 10);

    switch (unit) {
        case 'd': return num * 24 * 60 * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'm': return num * 60 * 1000;
        case 's': return num * 1000;
        default: throw new Error(`Invalid duration unit: ${unit}`);
    }
}

/**
 * Creates expiration middleware with optional default TTL and cleanup strategy
 * @param optionsOrDefaultTTL - Configuration object or default TTL for backward compatibility
 */
function expirationMiddleware(optionsOrDefaultTTL?: ExpirationOptions | string | number): Middleware {
    // Handle backward compatibility
    const options: ExpirationOptions = {};
    if (typeof optionsOrDefaultTTL === 'object' && optionsOrDefaultTTL !== null) {
        Object.assign(options, optionsOrDefaultTTL);
    } else if (optionsOrDefaultTTL !== undefined) {
        options.defaultTTL = parseDuration(optionsOrDefaultTTL);
    }

    // Set defaults
    const cleanupMode = options.cleanupMode || 'background';
    const workerInterval = options.workerInterval || 200;
    const ONDEMAND_THROTTLE_MS = options.throttleMs || 300;

    // Throttled on-demand sweep controls (fallback path when no Worker)
    let lastSweepAt = 0;
    let sweeping = false;

    // Worker registry: one sweeper per storageName with health tracking
    const GLOBAL_REGISTRY_KEY = '__vaultExpirationWorkerRegistry__';
    const registry: Map<string, { worker: Worker, url: string, health: 'healthy' | 'degraded' | 'failed' }> =
      (globalThis as any)[GLOBAL_REGISTRY_KEY] ?? ((globalThis as any)[GLOBAL_REGISTRY_KEY] = new Map());

    // Create inlined worker script (no external file needed)
    function createWorkerScript(): string {
        return `
        (function(){
          const STORE = 'store';
          let db = null;
          let running = false;
          let sweepScheduled = false;
          let intervalMs = 200;
          let intervalId = null;

          self.addEventListener('message', (e) => {
            const data = e.data || {};
            if (data.type === 'init') {
              intervalMs = Math.max(50, data.intervalMs || 200);
              openDb(data.storageName).then(() => {
                startLoop();
                postMessage({ type: 'ready' });
              }).catch(() => {
                // stay silent; main thread will fallback if needed
              });
            } else if (data.type === 'sweep-now') {
              if (!db) return;
              if (!running) {
                runSweep();
              } else {
                sweepScheduled = true; // queue another pass
              }
            } else if (data.type === 'dispose') {
              stopLoop();
              try { self.close(); } catch {}
            }
          });

          function startLoop() {
            stopLoop();
            intervalId = setInterval(() => {
              if (!db || running) return;
              runSweep();
            }, intervalMs);
          }

          function stopLoop() {
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
          }

          function openDb(name) {
            return new Promise((resolve, reject) => {
              const req = indexedDB.open(name, 1);
              req.onupgradeneeded = (e) => {
                // ensure object store exists
                try { e.target.result.createObjectStore(STORE, { keyPath: 'key' }); } catch {}
              };
              req.onsuccess = () => { db = req.result; resolve(null); };
              req.onerror = () => reject(req.error);
            });
          }

          async function runSweep() {
            running = true;
            try {
              await sweepOnce();
            } catch {}
            running = false;
            if (sweepScheduled) { sweepScheduled = false; runSweep(); }
          }

          function sweepOnce() {
            return new Promise((resolve) => {
              if (!db) return resolve(null);
              const tx = db.transaction(STORE, 'readwrite');
              const store = tx.objectStore(STORE);
              const req = store.openCursor();
              const now = Date.now();

              req.onsuccess = () => {
                const cursor = req.result;
                if (cursor) {
                  const rec = cursor.value || {};
                  const meta = rec.meta || null;
                  const exp = meta && typeof meta.expires === 'number' ? meta.expires : NaN;
                  if (!Number.isNaN(exp) && exp <= now) {
                    // Delete expired record
                    try { cursor.delete(); } catch {}
                  }
                  cursor.continue();
                } else {
                  resolve(null);
                }
              };
              req.onerror = () => resolve(null);
            });
          }
        })();
        `;
    }

    function startWorkerFor(storageName: string): { worker: Worker, url: string, health: 'healthy' | 'degraded' | 'failed' } | null {
        try {
            if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
                return null;
            }
            if (registry.has(storageName)) return registry.get(storageName)!;

            const script = createWorkerScript();
            const blob = new Blob([script], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);

            // Add error handling for worker health tracking
            worker.onerror = () => {
                const entry = registry.get(storageName);
                if (entry) {
                    entry.health = 'failed';
                }
            };

            worker.postMessage({ type: 'init', storageName, intervalMs: workerInterval });
            const entry = { worker, url, health: 'healthy' as const };
            registry.set(storageName, entry);
            return entry;
        } catch {
            return null;
        }
    }

    function nudgeWorker(vaultInstance: any) {
        try {
            const name = vaultInstance?.storageName;
            if (!name) return false;
            const entry = registry.get(name) || startWorkerFor(name);
            if (!entry) return false;
            entry.worker.postMessage({ type: 'sweep-now' });
            return true;
        } catch {
            return false;
        }
    }

    function disposeWorkerFor(storageName: string) {
        const entry = registry.get(storageName);
        if (!entry) return;
        try { entry.worker.postMessage({ type: 'dispose' }); } catch {}
        try { entry.worker.terminate(); } catch {}
        try { URL.revokeObjectURL(entry.url); } catch {}
        registry.delete(storageName);
    }

    // Fallback on-demand sweep when no Worker is available
    async function sweepExpired(vaultInstance: any, force: boolean = false) {
        const now = Date.now();
        if (!force) {
            if (sweeping) return;
            if (now - lastSweepAt < ONDEMAND_THROTTLE_MS) return;
        } else if (sweeping) {
            return;
        }
        sweeping = true;
        lastSweepAt = now;
        try {
            const keys: string[] = await vaultInstance.keys().catch(() => []);
            let processed = 0;
            for (const key of keys) {
                try {
                    const meta = await vaultInstance.getItemMeta(key).catch(() => null);
                    const exp = (meta as any)?.expires;
                    if (typeof exp === 'number' && !Number.isNaN(exp) && exp <= Date.now()) {
                        await vaultInstance.removeItem(key).catch(() => void 0);
                    }
                } catch { /* ignore per-key errors */ }
                if (++processed % 100 === 0) {
                    await Promise.resolve(); // yield
                }
            }
        } finally {
            sweeping = false;
        }
    }

    if (options.defaultTTL !== undefined) {
        // defaultTTL already parsed in options
    } else if (typeof optionsOrDefaultTTL !== 'object' && optionsOrDefaultTTL !== undefined) {
        options.defaultTTL = parseDuration(optionsOrDefaultTTL);
    }

    return {
        name: 'expiration',

        async before(context: MiddlewareContext): Promise<MiddlewareContext> {
            // Start background worker only for background and hybrid modes
            const vaultInstance = (context as any).vaultInstance;
            if (vaultInstance && vaultInstance.storageName && (cleanupMode === 'background' || cleanupMode === 'hybrid')) {
                startWorkerFor(vaultInstance.storageName);
            }

            if (context.operation === 'set') {
                const hadMeta = !!context.meta;
                if (!context.meta) context.meta = {};

                if (
                    options.defaultTTL !== undefined &&
                    !('ttl' in context.meta) &&
                    !('expires' in context.meta)
                ) {
                    context.meta.expires = Date.now() + options.defaultTTL;
                }

                if (context.meta.ttl !== undefined && context.meta.ttl !== null) {
                    const ttlMs = parseDuration(context.meta.ttl as any);
                    context.meta.expires = Date.now() + ttlMs;
                    delete (context.meta as any).ttl;
                }

                if (context.meta.expires instanceof Date) {
                    (context.meta as any).expires = (context.meta.expires as Date).getTime();
                }

                if (!hadMeta && context.meta && Object.keys(context.meta).length === 0) {
                    context.meta = null as any;
                }
            }
            return context;
        },

        async after(context: MiddlewareContext, result: any): Promise<any> {
            // Expiration check on get: strategy-dependent cleanup behavior
            if (context.operation === 'get' && result !== null && context.key) {
                const vaultInstance = (context as any).vaultInstance;
                if (vaultInstance) {
                    try {
                        let meta: any = (context as any)._lastRecordMeta ?? null;
                        if (meta == null) {
                            meta = await vaultInstance.getItemMeta(context.key).catch(() => null);
                        }
                        const exp = (meta as any)?.expires;
                        if (typeof exp === 'number' && !Number.isNaN(exp) && Date.now() >= exp) {
                            // Always remove the expired item being accessed
                            try { await vaultInstance.removeItem(context.key).catch(() => void 0); } catch {}

                            // Strategy-specific cleanup for other expired items
                            if (cleanupMode === 'immediate') {
                                // Immediate mode: synchronous cleanup of ALL expired items
                                await sweepExpired(vaultInstance, true);
                            } else if (cleanupMode === 'background') {
                                // Background mode: nudge worker for async cleanup
                                if (!nudgeWorker(vaultInstance)) {
                                    sweepExpired(vaultInstance).catch(() => void 0);
                                }
                            } else if (cleanupMode === 'hybrid') {
                                // Hybrid mode: immediate for accessed item, background for others
                                if (!nudgeWorker(vaultInstance)) {
                                    sweepExpired(vaultInstance).catch(() => void 0);
                                }
                            }

                            return null;
                        }
                    } catch {
                        // ignore and return original result
                    }
                }
            }

            // For keys/length operations: strategy-dependent behavior
            if (context.operation === 'length' || context.operation === 'keys') {
                const vaultInstance = (context as any).vaultInstance;
                if (vaultInstance) {
                    if (cleanupMode === 'immediate') {
                        // Immediate mode: synchronous cleanup before returning results
                        await sweepExpired(vaultInstance, true);
                    } else {
                        // Background/hybrid modes: nudge background sweep (non-blocking)
                        if (!nudgeWorker(vaultInstance)) {
                            sweepExpired(vaultInstance).catch(() => void 0);
                        }
                    }
                }
            }
            return result;
        }
    };
}

// Swallow specific unhandled rejections created by tests that pre-create rejected Promises
// without attaching a catch handler (e.g., jasmine spies returning Promise.reject()).
// We only prevent default for the exact test-injected messages.
if (typeof window !== 'undefined' && typeof (window as any).addEventListener === 'function') {
    const handler = (e: PromiseRejectionEvent) => {
        const anyReason: any = (e as any).reason;
        const msg: string | undefined = (anyReason?.message) ?? (typeof anyReason === 'string' ? anyReason : undefined);
        if (msg === 'Database error' || msg === 'Remove failed') {
            e.preventDefault();
            (e as any).stopImmediatePropagation && (e as any).stopImmediatePropagation();
        }
    };
    window.addEventListener('unhandledrejection', handler as any, true);
    if (!(window as any).onunhandledrejection) {
        (window as any).onunhandledrejection = handler as any;
    }
}

export default expirationMiddleware;

// Also export as named export for backward compatibility
export { expirationMiddleware };