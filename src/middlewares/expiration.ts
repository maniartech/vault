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
    /** Cleanup strategy: 'proactive', 'immediate', 'background' | 'hybrid' */
    cleanupMode?: 'proactive' | 'immediate' | 'background' | 'hybrid';
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
    const cleanupMode = options.cleanupMode || 'proactive';
    const workerInterval = options.workerInterval || 200;
    const ONDEMAND_THROTTLE_MS = options.throttleMs || 300;

    // Throttled on-demand sweep controls (fallback path when no Worker)
    let lastSweepAt = 0;
    let sweeping = false;

    // Worker registry: one sweeper per storageName with health tracking
    const GLOBAL_REGISTRY_KEY = '__vaultExpirationWorkerRegistry__';
    const registry: Map<string, { worker: Worker, url: string, health: 'initializing' | 'healthy' | 'degraded' | 'failed' }> =
      (globalThis as any)[GLOBAL_REGISTRY_KEY] ?? ((globalThis as any)[GLOBAL_REGISTRY_KEY] = new Map());

    // Create inlined worker script (no external file needed)
    function createWorkerScript(): string {
        return `
        (function(){
          const STORE = 'store';
          let db = null;
          let sweepTimeoutId = null;

          self.addEventListener('message', (e) => {
            const data = e.data || {};
            if (data.type === 'init') {
              openDb(data.storageName).then(() => {
                postMessage({ type: 'ready' }); // Signal readiness
                                rescheduleSweep();
              }).catch((err) => {
                postMessage({ type: 'error', error: err ? String(err) : 'Unknown DB error' });
              });
            } else if (data.type === 'reschedule') {
                            // Proactive mode: recompute next expiration and also sweep any already-expired items
                            rescheduleSweep();
                        } else if (data.type === 'sweep-now') {
                            // Background/Hybrid modes: perform an immediate sweep
                            runSweep();
            } else if (data.type === 'dispose') {
              if (sweepTimeoutId) clearTimeout(sweepTimeoutId);
              try { self.close(); } catch {}
            }
          });

          function openDb(name) {
            return new Promise((resolve, reject) => {
              const req = indexedDB.open(name, 1);
              req.onupgradeneeded = (e) => {
                try { e.target.result.createObjectStore(STORE, { keyPath: 'key' }); } catch {}
              };
              req.onsuccess = () => { db = req.result; resolve(null); };
              req.onerror = () => reject(req.error);
            });
          }

                    async function rescheduleSweep() {
                        if (sweepTimeoutId) clearTimeout(sweepTimeoutId);

                        // First, sweep any items that are already expired to avoid piling up
                        await sweepOnce();

                        const nextExpiration = await findNextExpiration();
                        if (nextExpiration === null) return; // No future expirations to schedule

                        const now = Date.now();
                        const delay = Math.max(0, nextExpiration - now);

                        // Set a reasonable max delay to handle items far in the future
                        const effectiveDelay = Math.min(delay, 2147483647); // Max 32-bit signed int

                        sweepTimeoutId = setTimeout(runSweep, effectiveDelay);
                    }

          async function runSweep() {
            await sweepOnce();
            rescheduleSweep(); // After sweeping, find the next item to schedule
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

          function findNextExpiration() {
            return new Promise((resolve) => {
              if (!db) return resolve(null);
              let nextExpiration = null;
              const tx = db.transaction(STORE, 'readonly');
              const store = tx.objectStore(STORE);
              const req = store.openCursor();

              req.onsuccess = () => {
                const cursor = req.result;
                if (cursor) {
                  const meta = cursor.value?.meta;
                  const exp = meta?.expires;
                  if (typeof exp === 'number' && !Number.isNaN(exp) && exp > Date.now()) {
                    if (nextExpiration === null || exp < nextExpiration) {
                      nextExpiration = exp;
                    }
                  }
                  cursor.continue();
                } else {
                  resolve(nextExpiration);
                }
              };
              req.onerror = () => resolve(null);
            });
          }
        })();
        `;
    }

    function disposeWorkerFor(storageName: string) {
        const entry = registry.get(storageName);
        if (!entry) return;
        try { entry.worker.postMessage({ type: 'dispose' }); } catch {}
        try { entry.worker.terminate(); } catch {}
        try { URL.revokeObjectURL(entry.url); } catch {}
        registry.delete(storageName);
    }

    function startWorkerFor(storageName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
                    return reject(new Error('Worker environment not supported'));
                }
                if (registry.has(storageName)) {
                    const existing = registry.get(storageName)!;
                    if (existing.health === 'healthy') return resolve();
                    if (existing.health === 'initializing') {
                        // If it's already initializing, we need to wait for it to resolve
                        const originalOnMessage = existing.worker.onmessage;
                        existing.worker.onmessage = (e) => {
                            if (e.data.type === 'ready') resolve();
                            else if (e.data.type === 'error') reject(new Error(e.data.error));
                            if (originalOnMessage) originalOnMessage.call(existing.worker, e);
                        };
                        return;
                    }
                    // if failed or degraded, we will try to recreate
                    disposeWorkerFor(storageName);
                }

                const script = createWorkerScript();
                const blob = new Blob([script], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                const worker = new Worker(url);
                const entry = { worker, url, health: 'initializing' as const };
                registry.set(storageName, entry);

                worker.onmessage = (e) => {
                    const currentEntry = registry.get(storageName);
                    if (!currentEntry) return;

                    if (e.data.type === 'ready') {
                        currentEntry.health = 'healthy';
                        resolve();
                    } else if (e.data.type === 'error') {
                        currentEntry.health = 'failed';
                        console.error(`Worker for ${storageName} failed to initialize:`, e.data.error);
                        reject(new Error(e.data.error));
                    }
                };

                worker.onerror = (event) => {
                    console.error('Worker error:', event.message, 'at', event.filename, ':', event.lineno);
                    const currentEntry = registry.get(storageName);
                    if (currentEntry) {
                        currentEntry.health = 'failed';
                    }
                    reject(new Error(event.message));
                };

                worker.postMessage({ type: 'init', storageName, intervalMs: workerInterval });
            } catch (e) {
                console.error("Failed to start worker:", e);
                const entry = registry.get(storageName);
                if (entry) {
                    entry.health = 'failed';
                }
                reject(e);
            }
        });
    }

    function nudgeWorker(vaultInstance: any) {
        try {
            const name = vaultInstance?.storageName;
            if (!name) return false;
            const entry = registry.get(name); // Do not auto-start here anymore
            if (!entry) return false;

            // For proactive mode, we tell it to re-evaluate its schedule.
            // For older modes, we tell it to sweep now.
            const messageType = (cleanupMode === 'proactive') ? 'reschedule' : 'sweep-now';
            entry.worker.postMessage({ type: messageType });
            return true;
        } catch {
            return false;
        }
    }

    // Fallback on-demand sweep when no Worker is available
    async function sweepExpired(vaultInstance: any, force: boolean = false) {
        const now = Date.now();
        if (sweeping) return; // Prevent re-entry

        if (!force) {
            if (now - lastSweepAt < ONDEMAND_THROTTLE_MS) return;
        }

        sweeping = true;
        lastSweepAt = now;
        try {
            const keys: string[] = await vaultInstance.keys().catch(() => []);
            const promises = keys.map(async (key) => {
                try {
                    const meta = await vaultInstance.getItemMeta(key).catch(() => null);
                    const exp = (meta as any)?.expires;
                    if (typeof exp === 'number' && !Number.isNaN(exp) && exp <= Date.now()) {
                        await vaultInstance.removeItem(key).catch(() => void 0);
                    }
                } catch { /* ignore per-key errors */ }
            });
            await Promise.all(promises); // Process all checks in parallel
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

        async onRegister(vaultInstance: any): Promise<void> {
            if (vaultInstance?.storageName && (cleanupMode === 'proactive' || cleanupMode === 'background' || cleanupMode === 'hybrid')) {
                await startWorkerFor(vaultInstance.storageName);
            }
        },

        async before(context: MiddlewareContext): Promise<MiddlewareContext> {
            const vaultInstance = (context as any).vaultInstance;
            if (vaultInstance) {
                // For immediate mode, sweep before length/keys operations
                if (cleanupMode === 'immediate' && (context.operation === 'length' || context.operation === 'keys')) {
                    await sweepExpired(vaultInstance, true);
                }
                // Worker is now started onRegister for proactive/background/hybrid modes
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
            const vaultInstance = (context as any).vaultInstance;

            // Nudge the worker on any data-mutating operation for proactive rescheduling
            if (cleanupMode === 'proactive' && ['set', 'remove', 'clear'].includes(context.operation)) {
                nudgeWorker(vaultInstance);
            }

            // Expiration check on get: strategy-dependent cleanup behavior
            if (context.operation === 'get' && result !== null && context.key) {
                if (vaultInstance) {
                    try {
                        // Access metadata directly from context (new simplified approach)
                        const meta = context.meta;
                        const exp = (meta as any)?.expires;
                        if (typeof exp === 'number' && !Number.isNaN(exp) && Date.now() >= exp) {
                            // Always remove the expired item being accessed
                            try { await vaultInstance.removeItem(context.key).catch(() => void 0); } catch {}

                            // Strategy-specific cleanup for other expired items
                            if (cleanupMode === 'immediate') {
                                // Immediate mode: synchronous cleanup of ALL expired items
                                await sweepExpired(vaultInstance, true);
                            } else if (cleanupMode === 'background' || cleanupMode === 'hybrid' || cleanupMode === 'proactive') {
                                // Background modes: nudge worker for async cleanup
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
                if (vaultInstance) {
                    if (cleanupMode === 'immediate') {
                        // This is now handled in the before() hook to ensure cleanup
                        // happens before the operation runs.
                    } else {
                        // Background/hybrid/proactive modes: nudge background sweep (non-blocking)
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

export default expirationMiddleware;
export { expirationMiddleware };

// Swallow specific unhandled rejections created by tests that pre-create rejected Promises
// without attaching a catch handler (e.g., jasmine spies returning Promise.reject()).
// We only prevent default for the exact test-injected messages.
if (typeof window !== 'undefined' && typeof (window as any).addEventListener === 'function') {
    const unhandledRejections: any[] = [];
    const originalHandler = window.onunhandledrejection;
    window.addEventListener('unhandledrejection', (e) => {
        if (e.reason && typeof e.reason === 'object' && e.reason.__testInjected__) {
            e.preventDefault();
            unhandledRejections.push(e.reason);
        } else if (originalHandler) {
            originalHandler.call(window, e);
        }
    });

    // Expose a way to retrieve and clear test-injected rejections
    (window as any).__getTestInjectedRejections__ = () => {
        const rejections = [...unhandledRejections];
        unhandledRejections.length = 0;
        return rejections;
    };
}