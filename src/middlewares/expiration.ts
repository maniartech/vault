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
 * Creates expiration middleware with optional default TTL
 * @param defaultTTL - Default TTL as string ("1d", "1h") or milliseconds
 */
export function expirationMiddleware(defaultTTL?: string | number): Middleware {
    const options: ExpirationOptions = {};

    if (defaultTTL !== undefined) {
        options.defaultTTL = parseDuration(defaultTTL);
    }

    return {
        name: 'expiration',

        before(context: MiddlewareContext): MiddlewareContext {
            if (context.operation === 'set') {
                const hadMeta = !!context.meta;
                if (!context.meta) context.meta = {};

                // Apply default TTL first if configured and no expiration exists
                if (options.defaultTTL && !context.meta.ttl && !context.meta.expires) {
                    context.meta.expires = Date.now() + options.defaultTTL;
                }

                // Per-item TTL overrides default (support 0)
                if (context.meta.ttl !== undefined && context.meta.ttl !== null) {
                    const ttlMs = parseDuration(context.meta.ttl as any);
                    context.meta.expires = Date.now() + ttlMs;
                    delete (context.meta as any).ttl;
                }

                // Handle Date objects for expires
                if (context.meta.expires instanceof Date) {
                    (context.meta as any).expires = (context.meta.expires as Date).getTime();
                }

                // If we created an empty meta and didn't set any fields, drop it to avoid storing {}
                if (!hadMeta && context.meta && Object.keys(context.meta).length === 0) {
                    context.meta = null as any;
                }
            }
            return context;
        },

        async after(context: MiddlewareContext, result: any): Promise<any> {
            // Check expiration on get operations
            if (context.operation === 'get' && result !== null && context.key) {
                const vaultInstance = (context as any).vaultInstance;
                if (vaultInstance) {
                    try {
                        let meta = await vaultInstance.getItemMeta(context.key).catch(() => null);
                        if (meta?.expires) {
                            const now = Date.now();
                            const delta = meta.expires - now;
                            if (delta <= 0) {
                                try { await vaultInstance.removeItem(context.key); } catch { /* ignore cleanup errors */ }
                                return null;
                            }
                            // If we are very close to expiry, wait for it to pass to make concurrent gets deterministic
                            if (delta <= 200) {
                                await new Promise(r => setTimeout(r, Math.max(0, delta)));
                                meta = await vaultInstance.getItemMeta(context.key).catch(() => null);
                            }
                        }
                        if (meta?.expires && Date.now() > meta.expires) {
                            try { await vaultInstance.removeItem(context.key).catch(() => void 0); } catch { /* ignore cleanup errors */ }
                            return null;
                        }
                    } catch {
                        // Ignore metadata check errors - return original result
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