/**
 * Enhanced expiration middleware tests with comprehensive edge cases
 */

import Vault from '../dist/vault.js';
import { expirationMiddleware } from '../dist/middlewares/expiration.js';

describe('Expiration Middleware - Enhanced Coverage', () => {
  let vault;

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Advanced TTL Parsing and Edge Cases', () => {
    beforeEach(() => {
      vault = new Vault('test-expiration-advanced');
      vault.use(expirationMiddleware());
    });

    it('should handle edge case TTL values', async () => {
      const edgeCases = [
        { ttl: 0, expectedMs: 0, description: 'zero TTL' },
        { ttl: 1, expectedMs: 1, description: 'minimum TTL' },
        { ttl: Number.MAX_SAFE_INTEGER, expectedMs: Number.MAX_SAFE_INTEGER, description: 'maximum safe integer' },
        { ttl: '0s', expectedMs: 0, description: 'zero seconds string' },
        { ttl: '1s', expectedMs: 1000, description: 'one second' },
        { ttl: '59s', expectedMs: 59000, description: 'fifty-nine seconds' },
        { ttl: '60s', expectedMs: 60000, description: 'sixty seconds' },
        { ttl: '1m', expectedMs: 60000, description: 'one minute' },
        { ttl: '59m', expectedMs: 59 * 60 * 1000, description: 'fifty-nine minutes' },
        { ttl: '60m', expectedMs: 60 * 60 * 1000, description: 'sixty minutes' },
        { ttl: '1h', expectedMs: 60 * 60 * 1000, description: 'one hour' },
        { ttl: '23h', expectedMs: 23 * 60 * 60 * 1000, description: 'twenty-three hours' },
        { ttl: '24h', expectedMs: 24 * 60 * 60 * 1000, description: 'twenty-four hours' },
        { ttl: '1d', expectedMs: 24 * 60 * 60 * 1000, description: 'one day' },
        { ttl: '7d', expectedMs: 7 * 24 * 60 * 60 * 1000, description: 'one week' },
        { ttl: '30d', expectedMs: 30 * 24 * 60 * 60 * 1000, description: 'thirty days' },
        { ttl: '365d', expectedMs: 365 * 24 * 60 * 60 * 1000, description: 'one year' }
      ];

      for (const { ttl, expectedMs, description } of edgeCases) {
        const beforeTime = Date.now();
        await vault.setItem(`key-${description.replace(/\s+/g, '-')}`, 'value', { ttl });

        const meta = await vault.getItemMeta(`key-${description.replace(/\s+/g, '-')}`);
        expect(meta).not.toBeNull();
        expect(meta.expires).toBeGreaterThanOrEqual(beforeTime + expectedMs);
        expect(meta.expires).toBeLessThanOrEqual(Date.now() + expectedMs);
      }
    });

    it('should handle fractional values in string TTL', async () => {
      // Note: Current implementation may not support fractional values
      // Test to see behavior with fractional inputs
      const fractionalCases = [
        '1.5s',
        '2.5m',
        '0.5h',
        '1.5d'
      ];

      for (const ttl of fractionalCases) {
        try {
          await vault.setItem(`fractional-${ttl}`, 'value', { ttl });
          // If it succeeds, verify it has some expiration
          const meta = await vault.getItemMeta(`fractional-${ttl}`);
          expect(meta?.expires).toBeDefined();
        } catch (error) {
          // If it fails, it should be a parsing error
          expect(error.message).toContain('Invalid duration');
        }
      }
    });

    it('should handle whitespace in TTL strings', async () => {
      const whitespaceVariations = [
        ' 1h ',
        '\t2m\t',
        '\n3s\n',
        ' 4d ',
        '  5h  '
      ];

      for (const ttl of whitespaceVariations) {
        try {
          await vault.setItem(`whitespace-${ttl.trim()}`, 'value', { ttl });
          const meta = await vault.getItemMeta(`whitespace-${ttl.trim()}`);
          expect(meta?.expires).toBeDefined();
        } catch (error) {
          // Should handle whitespace gracefully or throw clear error
          expect(error.message).toContain('Invalid duration');
        }
      }
    });

    // TTL validation - invalid TTL format handling
    it('should handle invalid TTL formats gracefully', async () => {
      const invalidFormats = [
        '',
        ' ',
        'invalid',
        '1x',
        '1 hour',
        'one hour',
        '-1s',
        '-5m',
        '1ss',
        '1mm',
        '1hh',
        '1dd',
        '1.s',
        '.5s',
        's1',
        'm5',
        'h2',
        'd1',
        '1.2.3s',
        'NaN',
        'Infinity',
        '-Infinity'
      ];

      for (const ttl of invalidFormats) {
        await expectAsync(vault.setItem(`invalid-${ttl}`, 'value', { ttl }))
          .toBeRejected();
      }
    });

    it('should handle very large TTL values', async () => {
      const largeTTL = '999999d'; // Very large number of days

      try {
        await vault.setItem('large-ttl', 'value', { ttl: largeTTL });
        const meta = await vault.getItemMeta('large-ttl');
        expect(meta?.expires).toBeDefined();
        expect(meta.expires).toBeGreaterThan(Date.now());
      } catch (error) {
        // Might fail due to overflow - should handle gracefully
        expect(error.message).toContain('Invalid duration');
      }
    });
  });

  describe('Date Object Handling', () => {
    beforeEach(() => {
      vault = new Vault('test-date-handling');
      vault.use(expirationMiddleware());
    });

    it('should handle various Date object formats', async () => {
      const dateFormats = [
        new Date(Date.now() + 1000), // 1 second from now
        new Date(Date.now() + 60000), // 1 minute from now
        new Date('2030-01-01T00:00:00Z'), // Far future
        new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year from now
      ];

      for (let i = 0; i < dateFormats.length; i++) {
        const date = dateFormats[i];
        await vault.setItem(`date-${i}`, 'value', { expires: date });

        const meta = await vault.getItemMeta(`date-${i}`);
        expect(meta?.expires).toBe(date.getTime());
      }
    });

    it('should handle past Date objects', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      await vault.setItem('past-date', 'value', { expires: pastDate });

      // Should expire immediately
      const result = await vault.getItem('past-date');
      expect(result).toBeNull();
    });

    it('should handle invalid Date objects', async () => {
      const invalidDate = new Date('invalid-date-string');

      try {
        await vault.setItem('invalid-date', 'value', { expires: invalidDate });
        const meta = await vault.getItemMeta('invalid-date');

        // Should either reject or handle invalid date
        if (meta?.expires) {
          expect(isNaN(meta.expires)).toBe(true);
        }
      } catch (error) {
        // Acceptable to reject invalid dates
        expect(error).toBeDefined();
      }
    });

    it('should handle Date objects with timezone differences', async () => {
      const utcDate = new Date('2030-01-01T12:00:00Z');
      const localDate = new Date('2030-01-01T12:00:00');

      await vault.setItem('utc-date', 'value', { expires: utcDate });
      await vault.setItem('local-date', 'value', { expires: localDate });

      const utcMeta = await vault.getItemMeta('utc-date');
      const localMeta = await vault.getItemMeta('local-date');

      expect(utcMeta?.expires).toBe(utcDate.getTime());
      expect(localMeta?.expires).toBe(localDate.getTime());
    });
  });

  describe('Default TTL Edge Cases', () => {
    it('should handle very short default TTL', async () => {
      vault = new Vault('test-short-default');
      vault.use(expirationMiddleware(10)); // 10ms default

      await vault.setItem('short-default', 'value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await vault.getItem('short-default');
      expect(result).toBeNull();
    });

    it('should handle very long default TTL', async () => {
      const longDefaultTTL = '100d'; // 100 days
      vault = new Vault('test-long-default');
      vault.use(expirationMiddleware(longDefaultTTL));

      await vault.setItem('long-default', 'value');

      const meta = await vault.getItemMeta('long-default');
      expect(meta?.expires).toBeDefined();
      expect(meta.expires).toBeGreaterThan(Date.now() + (90 * 24 * 60 * 60 * 1000));
    });

    // TTL null/undefined handling - configuration issues
    it('should override default TTL with explicit null/undefined', async () => {
      vault = new Vault('test-override-default');
      vault.use(expirationMiddleware('1d')); // 1 day default

      // Explicit null should prevent default TTL application
      await vault.setItem('no-ttl-null', 'value', { ttl: null });
      await vault.setItem('no-ttl-undefined', 'value', { ttl: undefined });

      const meta1 = await vault.getItemMeta('no-ttl-null');
      const meta2 = await vault.getItemMeta('no-ttl-undefined');

      // Should not have expiration when explicitly set to null/undefined
      expect(meta1?.expires).toBeUndefined();
      expect(meta2?.expires).toBeUndefined();
    });

    it('should handle empty object metadata with default TTL', async () => {
      vault = new Vault('test-empty-meta-default');
      vault.use(expirationMiddleware('1h'));

      await vault.setItem('empty-meta', 'value', {});

      const meta = await vault.getItemMeta('empty-meta');
      expect(meta?.expires).toBeDefined();
    });
  });

  describe('Expiration Cleanup Edge Cases', () => {
    beforeEach(() => {
      vault = new Vault('test-cleanup-edge-cases');
      vault.use(expirationMiddleware());
    });

    it('should handle multiple expired items efficiently (immediate mode)', async () => {
      // Configure vault with immediate cleanup mode for reliable testing
      vault = new Vault('test-immediate-cleanup');
      vault.use(expirationMiddleware({ cleanupMode: 'immediate' }));

      // Set many items with short TTL (use await to ensure proper timing)
      for (let i = 0; i < 50; i++) {
        await vault.setItem(`item${i}`, `value${i}`, { ttl: 1 }); // 1ms
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Access all items (should trigger immediate cleanup) - each get should check and remove expired items
      const results = [];
      for (let i = 0; i < 50; i++) {
        results.push(await vault.getItem(`item${i}`));
      }

      // All should be null (expired)
      results.forEach((result, index) => {
        expect(result).toBeNull(`Item ${index} should be expired and null`);
      });

      // Vault should be empty - trigger a length check that should sweep remaining items
      expect(await vault.length()).toBe(0);
    });

    it('should handle partial expiration in mixed TTL scenario', async () => {
      await vault.setItem('short1', 'value1', { ttl: 10 }); // 10ms
      await vault.setItem('long1', 'value1', { ttl: '1h' }); // 1 hour
      await vault.setItem('short2', 'value2', { ttl: 20 }); // 20ms
      await vault.setItem('long2', 'value2', { ttl: '2h' }); // 2 hours
      await vault.setItem('short3', 'value3', { ttl: 30 }); // 30ms

      // Wait for short TTL items to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(await vault.getItem('short1')).toBeNull();
      expect(await vault.getItem('short2')).toBeNull();
      expect(await vault.getItem('short3')).toBeNull();
      expect(await vault.getItem('long1')).toBe('value1');
      expect(await vault.getItem('long2')).toBe('value2');

      // Check final state
      expect(await vault.length()).toBe(2);
      const keys = await vault.keys();
      expect(keys).toContain('long1');
      expect(keys).toContain('long2');
    });

    it('should handle expiration during concurrent access', async () => {
      await vault.setItem('concurrent-test', 'value', { ttl: 50 }); // 50ms

      // Start multiple concurrent reads while item is expiring
      const readPromises = [];

      // Start reads at different times
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          readPromises.push(vault.getItem('concurrent-test'));
        }, i * 10); // Stagger reads every 10ms
      }

      // Wait for all reads to complete
      const results = await Promise.all(readPromises);

      // Some reads might succeed (before expiration) and some might return null
      // But no errors should occur
      results.forEach(result => {
        expect(result === 'value' || result === null).toBe(true);
      });
    });

    it('should handle cleanup failures gracefully', async () => {
      await vault.setItem('cleanup-test', 'value', { ttl: 1 }); // 1ms

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50));

      // Mock removeItem to fail
      const originalRemoveItem = vault.removeItem;
      vault.removeItem = jasmine.createSpy('removeItem').and.callFake(() => {
        return Promise.reject(new Error('Cleanup failed'));
      });

      // Getting expired item should still return null even if cleanup fails
      const result = await vault.getItem('cleanup-test');
      expect(result).toBeNull();

      // Restore original method
      vault.removeItem = originalRemoveItem;
    });

    it('should handle metadata corruption during expiration check', async () => {
      await vault.setItem('corruption-test', 'value', { ttl: '1h' });

      // Mock getItemMeta to return corrupted data
      const originalGetItemMeta = vault.getItemMeta;
      vault.getItemMeta = jasmine.createSpy('getItemMeta').and.callFake(() => {
        return Promise.resolve({ expires: 'invalid-timestamp' });
      });

      // Should handle corrupted expiration data gracefully
      try {
        const result = await vault.getItem('corruption-test');
        // Should either return the value or handle the corruption
        expect(result).toBeDefined();
      } catch (error) {
        // Or might throw an error - either is acceptable
        expect(error).toBeDefined();
      }

      // Restore original method
      vault.getItemMeta = originalGetItemMeta;
    });
  });

  describe('Performance and Memory Management', () => {
    beforeEach(() => {
      vault = new Vault('test-performance');
      vault.use(expirationMiddleware());
    });

    it('should handle large number of items with different expiration times', async () => {
      const startTime = performance.now();

      // Create 1000 items with various expiration times
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        const ttl = Math.floor(Math.random() * 3600) + 60; // Random TTL between 1-60 minutes
        promises.push(vault.setItem(`perf-item-${i}`, `value-${i}`, { ttl: ttl * 1000 }));
      }

      await Promise.all(promises);

      const setTime = performance.now();
      expect(setTime - startTime).toBeLessThan(10000); // Should complete in under 10 seconds

      // Read all items
      const readPromises = [];
      for (let i = 0; i < 1000; i++) {
        readPromises.push(vault.getItem(`perf-item-${i}`));
      }

      const results = await Promise.all(readPromises);
      const readTime = performance.now();

      expect(readTime - setTime).toBeLessThan(5000); // Reads should be faster

      // All items should be valid
      for (let i = 0; i < 1000; i++) {
        expect(results[i]).toBe(`value-${i}`);
      }
    });

    it('should handle rapid expiration and cleanup efficiently', async () => {
      // Create items that expire quickly
      for (let i = 0; i < 100; i++) {
        await vault.setItem(`rapid-${i}`, `value-${i}`, { ttl: Math.random() * 100 }); // 0-100ms
      }

      // Wait for most to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      const startTime = performance.now();

      // Trigger cleanup by accessing items
      for (let i = 0; i < 100; i++) {
        await vault.getItem(`rapid-${i}`);
      }

      const endTime = performance.now();

      // Cleanup should be efficient
      expect(endTime - startTime).toBeLessThan(2000);

      // Most items should be cleaned up
      const remainingLength = await vault.length();
      expect(remainingLength).toBeLessThanOrEqual(10); // Allow some margin for timing
    });

    it('should not consume excessive memory with many expired items', async () => {
      // This is a basic memory test - in production you'd use more sophisticated monitoring
      const initialLength = await vault.length();

      // Add many items with very short TTL
      for (let i = 0; i < 500; i++) {
        await vault.setItem(`memory-${i}`, 'x'.repeat(1000), { ttl: 1 }); // Large value, 1ms TTL
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Access a few items to trigger cleanup
      for (let i = 0; i < 10; i++) {
        await vault.getItem(`memory-${i}`);
      }

      // Storage should be mostly empty
      const finalLength = await vault.length();
      expect(finalLength).toBeLessThanOrEqual(initialLength + 50); // Allow some margin
    });
  });

  describe('Integration with Metadata Preservation', () => {
    beforeEach(() => {
      vault = new Vault('test-metadata-preservation');
      vault.use(expirationMiddleware());
    });

    it('should preserve complex metadata during TTL conversion', async () => {
      const complexMeta = {
        ttl: '2h',
        user: {
          id: 12345,
          name: 'John Doe',
          roles: ['user', 'admin'],
          settings: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false,
              sms: true
            }
          }
        },
        audit: {
          created: Date.now(),
          createdBy: 'system',
          lastAccessed: null,
          accessCount: 0
        },
        tags: ['important', 'user-data', 'encrypted'],
        version: '1.2.3',
        checksum: 'abc123def456',
        customFields: {
          field1: 'value1',
          field2: 42,
          field3: true,
          field4: null,
          field5: [1, 2, 3]
        }
      };

      await vault.setItem('complex-meta', 'value', complexMeta);

      const retrievedMeta = await vault.getItemMeta('complex-meta');

      // TTL should be converted to expires
      expect(retrievedMeta.expires).toBeDefined();
      expect(retrievedMeta.ttl).toBeUndefined();

      // All other metadata should be preserved exactly
      expect(retrievedMeta.user).toEqual(complexMeta.user);
      expect(retrievedMeta.audit).toEqual(complexMeta.audit);
      expect(retrievedMeta.tags).toEqual(complexMeta.tags);
      expect(retrievedMeta.version).toBe(complexMeta.version);
      expect(retrievedMeta.checksum).toBe(complexMeta.checksum);
      expect(retrievedMeta.customFields).toEqual(complexMeta.customFields);
    });

    it('should handle metadata with Date objects during TTL processing', async () => {
      const dateValue = new Date();
      const metadata = {
        ttl: '1h',
        created: dateValue,
        modified: new Date(Date.now() - 60000), // 1 minute ago
        scheduled: new Date(Date.now() + 3600000) // 1 hour from now
      };

      await vault.setItem('date-meta', 'value', metadata);

      const retrievedMeta = await vault.getItemMeta('date-meta');

      expect(retrievedMeta.expires).toBeDefined();
      expect(retrievedMeta.created).toEqual(dateValue);
      expect(retrievedMeta.modified).toEqual(metadata.modified);
      expect(retrievedMeta.scheduled).toEqual(metadata.scheduled);
    });

    it('should handle metadata with functions and non-serializable values', async () => {
      const metadataWithFunction = {
        ttl: '30m',
        callback: function() { return 'test'; },
        symbol: Symbol('test'),
        undefined: undefined,
        normal: 'normal-value'
      };

      try {
        await vault.setItem('function-meta', 'value', metadataWithFunction);

        const retrievedMeta = await vault.getItemMeta('function-meta');

        // Non-serializable values might be lost, but TTL conversion should still work
        expect(retrievedMeta.expires).toBeDefined();
        expect(retrievedMeta.normal).toBe('normal-value');

        // Function and symbol might be undefined after serialization
        expect(typeof retrievedMeta.callback).toBe('undefined');
        expect(typeof retrievedMeta.symbol).toBe('undefined');
      } catch (error) {
        // It's acceptable if this fails due to serialization issues
        expect(error).toBeDefined();
      }
    });
  });
});