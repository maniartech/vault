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
    if (typeof duration === 'number') return duration;

    const match = duration.match(/^(\d+)([a-z])$/);
    if (!match) throw new Error(`Invalid duration format: ${duration}`);

    const [, value, unit] = match;
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
                // Ensure meta exists
                if (!context.meta) {
                    context.meta = {};
                }

                // Apply default TTL first if configured and no expiration exists
                if (options.defaultTTL && !context.meta.ttl && !context.meta.expires) {
                    context.meta.expires = Date.now() + options.defaultTTL;
                }

                // Per-item TTL overrides default
                if (context.meta.ttl) {
                    const ttlMs = parseDuration(context.meta.ttl);
                    context.meta.expires = Date.now() + ttlMs;
                    delete context.meta.ttl;
                }

                // Handle Date objects for expires
                if (context.meta.expires instanceof Date) {
                    context.meta.expires = context.meta.expires.getTime();
                }
            }
            return context;
        },

        async after(context: MiddlewareContext, result: any): Promise<any> {
            // Check expiration on get operations
            if (context.operation === 'get' && result !== null && context.key) {
                // Access the vault instance from context
                const vaultInstance = (context as any).vaultInstance;
                if (vaultInstance) {
                    try {
                        const meta = await vaultInstance.getItemMeta(context.key);
                        if (meta?.expires && Date.now() > meta.expires) {
                            // Item expired - remove it and return null
                            await vaultInstance.removeItem(context.key);
                            return null;
                        }
                    } catch {
                        // Ignore metadata check errors - item might not exist
                    }
                }
            }
            return result;
        }
    };
}