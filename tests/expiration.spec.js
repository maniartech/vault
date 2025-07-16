/**
 * Comprehensive tests for expiration middleware
 */

import Vault from '../vault.js';
import { expirationMiddleware } from '../middlewares/expiration.js';

describe('Expiration Middleware', () => {
    let vault;

    afterEach(async () => {
        if (vault) {
            await vault.clear();
        }
    });

    describe('TTL Conversion', () => {
        beforeEach(() => {
            vault = new Vault('test-expiration-ttl');
            vault.use(expirationMiddleware());
        });

        it('should convert numeric TTL to expires timestamp', async () => {
            const beforeTime = Date.now();
            await vault.setItem('key', 'value', { ttl: 1000 });

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBeGreaterThanOrEqual(beforeTime + 1000);
            expect(meta.expires).toBeLessThanOrEqual(Date.now() + 1000);
            expect(meta.ttl).toBeUndefined(); // TTL should be removed after conversion
        });

        it('should convert string TTL formats correctly', async () => {
            const testCases = [
                { ttl: '1s', expectedMs: 1000 },
                { ttl: '2m', expectedMs: 2 * 60 * 1000 },
                { ttl: '3h', expectedMs: 3 * 60 * 60 * 1000 },
                { ttl: '1d', expectedMs: 24 * 60 * 60 * 1000 }
            ];

            for (const { ttl, expectedMs } of testCases) {
                const beforeTime = Date.now();
                await vault.setItem(`key-${ttl}`, 'value', { ttl });

                const meta = await vault.getItemMeta(`key-${ttl}`);
                expect(meta).not.toBeNull();
                expect(meta.expires).toBeGreaterThanOrEqual(beforeTime + expectedMs);
                expect(meta.expires).toBeLessThanOrEqual(Date.now() + expectedMs);
                expect(meta.ttl).toBeUndefined();
            }
        });

        it('should handle Date objects for expires', async () => {
            const futureDate = new Date(Date.now() + 5000);
            await vault.setItem('key', 'value', { expires: futureDate });

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBe(futureDate.getTime());
        });

        it('should preserve existing expires timestamp', async () => {
            const expiresTime = Date.now() + 10000;
            await vault.setItem('key', 'value', { expires: expiresTime });

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBe(expiresTime);
        });

        it('should throw error for invalid TTL format', async () => {
            await expectAsync(vault.setItem('key', 'value', { ttl: 'invalid' }))
                .toBeRejectedWithError('Invalid duration format: invalid');
        });

        it('should throw error for invalid TTL unit', async () => {
            await expectAsync(vault.setItem('key', 'value', { ttl: '1x' }))
                .toBeRejectedWithError('Invalid duration unit: x');
        });
    });

    describe('Default TTL', () => {
        it('should apply default TTL when no expiration specified', async () => {
            vault = new Vault('test-default-ttl');
            vault.use(expirationMiddleware('1h'));

            const beforeTime = Date.now();
            await vault.setItem('key', 'value');

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBeGreaterThanOrEqual(beforeTime + (60 * 60 * 1000));
            expect(meta.expires).toBeLessThanOrEqual(Date.now() + (60 * 60 * 1000));
        });

        it('should allow per-item TTL to override default', async () => {
            vault = new Vault('test-override-ttl');
            vault.use(expirationMiddleware('1d')); // Default 1 day

            const beforeTime = Date.now();
            await vault.setItem('key', 'value', { ttl: '1h' }); // Override with 1 hour

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            const expectedExpires = beforeTime + (60 * 60 * 1000); // 1 hour, not 1 day
            expect(meta.expires).toBeGreaterThanOrEqual(expectedExpires);
            expect(meta.expires).toBeLessThanOrEqual(Date.now() + (60 * 60 * 1000));
        });

        it('should allow per-item expires to override default', async () => {
            vault = new Vault('test-override-expires');
            vault.use(expirationMiddleware('1d')); // Default 1 day

            const customExpires = Date.now() + 5000; // 5 seconds
            await vault.setItem('key', 'value', { expires: customExpires });

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBe(customExpires);
        });

        it('should support numeric default TTL', async () => {
            vault = new Vault('test-numeric-default');
            vault.use(expirationMiddleware(5000)); // 5 seconds in milliseconds

            const beforeTime = Date.now();
            await vault.setItem('key', 'value');

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBeGreaterThanOrEqual(beforeTime + 5000);
            expect(meta.expires).toBeLessThanOrEqual(Date.now() + 5000);
        });

        it('should not apply default TTL when expires is already set', async () => {
            vault = new Vault('test-no-override');
            vault.use(expirationMiddleware('1d'));

            const customExpires = Date.now() + 5000;
            await vault.setItem('key', 'value', { expires: customExpires });

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBe(customExpires); // Should not be overridden by default
        });
    });

    describe('Expiration Cleanup', () => {
        beforeEach(() => {
            vault = new Vault('test-expiration-cleanup');
            vault.use(expirationMiddleware());
        });

        it('should return null for expired items', async () => {
            // Set item with very short TTL
            await vault.setItem('key', 'value', { ttl: 1 }); // 1ms

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 10));

            const result = await vault.getItem('key');
            expect(result).toBeNull();
        });

        it('should automatically remove expired items from storage', async () => {
            await vault.setItem('key', 'value', { ttl: 1 }); // 1ms

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 10));

            // Access the item (should trigger cleanup)
            await vault.getItem('key');

            // Verify item is actually removed from storage
            const meta = await vault.getItemMeta('key');
            expect(meta).toBeNull();
        });

        it('should return valid items that have not expired', async () => {
            await vault.setItem('key', 'value', { ttl: '1h' });

            const result = await vault.getItem('key');
            expect(result).toBe('value');
        });

        it('should handle items without expiration metadata', async () => {
            // Set item without any expiration
            await vault.setItem('key', 'value');

            const result = await vault.getItem('key');
            expect(result).toBe('value'); // Should not be affected
        });

        it('should handle zero TTL (immediate expiration)', async () => {
            await vault.setItem('key', 'value', { ttl: 0 });

            // Item should expire immediately
            const result = await vault.getItem('key');
            expect(result).toBeNull();
        });

        it('should handle negative expires timestamp', async () => {
            await vault.setItem('key', 'value', { expires: Date.now() - 1000 });

            const result = await vault.getItem('key');
            expect(result).toBeNull();
        });
    });

    describe('Integration Tests', () => {
        it('should work with multiple items having different expiration times', async () => {
            vault = new Vault('test-multiple-items');
            vault.use(expirationMiddleware());

            await vault.setItem('short', 'value1', { ttl: 10 }); // 10ms
            await vault.setItem('long', 'value2', { ttl: '1h' }); // 1 hour
            await vault.setItem('medium', 'value3', { ttl: 100 }); // 100ms

            // Wait for short and medium to expire
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(await vault.getItem('short')).toBeNull();
            expect(await vault.getItem('medium')).toBeNull();
            expect(await vault.getItem('long')).toBe('value2');
        });

        it('should work with default TTL and mixed per-item expiration', async () => {
            vault = new Vault('test-mixed-expiration');
            vault.use(expirationMiddleware(50)); // 50ms default

            await vault.setItem('default1', 'value1'); // Uses default 50ms
            await vault.setItem('default2', 'value2'); // Uses default 50ms
            await vault.setItem('custom', 'value3', { ttl: '1h' }); // Custom 1 hour

            // Wait for defaults to expire
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(await vault.getItem('default1')).toBeNull();
            expect(await vault.getItem('default2')).toBeNull();
            expect(await vault.getItem('custom')).toBe('value3');
        });

        it('should preserve other metadata while adding expiration', async () => {
            vault = new Vault('test-preserve-metadata');
            vault.use(expirationMiddleware());

            const customMeta = {
                ttl: '1h',
                userId: 123,
                tags: ['important', 'user-data'],
                version: '1.0'
            };

            await vault.setItem('key', 'value', customMeta);

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.userId).toBe(123);
            expect(meta.tags).toEqual(['important', 'user-data']);
            expect(meta.version).toBe('1.0');
            expect(meta.expires).toBeDefined();
            expect(meta.ttl).toBeUndefined(); // TTL should be converted to expires
        });

        it('should not interfere with non-set operations', async () => {
            vault = new Vault('test-non-set-operations');
            vault.use(expirationMiddleware('1d'));

            await vault.setItem('key1', 'value1');
            await vault.setItem('key2', 'value2');

            const keys = await vault.keys();
            expect(keys).toContain('key1');
            expect(keys).toContain('key2');

            const length = await vault.length();
            expect(length).toBe(2);

            await vault.removeItem('key1');
            expect(await vault.getItem('key1')).toBeNull();
            expect(await vault.getItem('key2')).toBe('value2');
        });

        it('should handle very large TTL values', async () => {
            vault = new Vault('test-large-ttl');
            vault.use(expirationMiddleware());

            const largeTTL = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
            await vault.setItem('key', 'value', { ttl: largeTTL });

            const meta = await vault.getItemMeta('key');
            expect(meta).not.toBeNull();
            expect(meta.expires).toBeGreaterThan(Date.now() + largeTTL - 1000);

            // Item should still be valid
            const result = await vault.getItem('key');
            expect(result).toBe('value');
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            vault = new Vault('test-error-handling');
            vault.use(expirationMiddleware());
        });

        it('should handle metadata access errors gracefully', async () => {
            await vault.setItem('key', 'value', { ttl: '1h' });

            // Mock getItemMeta to throw error
            const originalGetItemMeta = vault.getItemMeta;
            vault.getItemMeta = jasmine.createSpy('getItemMeta').and.returnValue(Promise.reject(new Error('Database error')));

            // Should not throw error, just return the value
            const result = await vault.getItem('key');
            expect(result).toBe('value');

            // Restore original method
            vault.getItemMeta = originalGetItemMeta;
        });

        it('should handle removeItem errors gracefully during cleanup', async () => {
            await vault.setItem('key', 'value', { ttl: 1 }); // 1ms

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 10));

            // Mock removeItem to throw error
            const originalRemoveItem = vault.removeItem;
            vault.removeItem = jasmine.createSpy('removeItem').and.returnValue(Promise.reject(new Error('Remove failed')));

            // Should still return null even if cleanup fails
            const result = await vault.getItem('key');
            expect(result).toBeNull();

            // Restore original method
            vault.removeItem = originalRemoveItem;
        });

        it('should handle concurrent access to expiring items', async () => {
            await vault.setItem('key', 'value', { ttl: 50 });

            // Start multiple concurrent gets
            const promises = Array(5).fill().map(() => vault.getItem('key'));

            // Wait for expiration during concurrent access
            await new Promise(resolve => setTimeout(resolve, 100));

            const results = await Promise.all(promises);
            // All should be null since item expired
            results.forEach(result => expect(result).toBeNull());
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            vault = new Vault('test-edge-cases');
            vault.use(expirationMiddleware());
        });

        it('should handle empty metadata object', async () => {
            await vault.setItem('key', 'value', {});

            const result = await vault.getItem('key');
            expect(result).toBe('value');
        });

        it('should handle null metadata', async () => {
            await vault.setItem('key', 'value', null);

            const result = await vault.getItem('key');
            expect(result).toBe('value');
        });

        it('should handle undefined metadata', async () => {
            await vault.setItem('key', 'value', undefined);

            const result = await vault.getItem('key');
            expect(result).toBe('value');
        });

        it('should work without any middleware configuration', async () => {
            vault = new Vault('test-no-config');
            vault.use(expirationMiddleware()); // No default TTL

            await vault.setItem('key', 'value');

            const result = await vault.getItem('key');
            expect(result).toBe('value');

            const meta = await vault.getItemMeta('key');
            expect(meta).toBeNull(); // No metadata should be created
        });
    });
});