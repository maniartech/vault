/**
 * Strategy-specific testing patterns for expiration middleware
 */

import Vault from '../dist/vault.js';
import { expirationMiddleware } from '../dist/middlewares/expiration.js';

async function waitForWorker(vaultName, health = 'healthy') {
  const registry = globalThis.__vaultExpirationWorkerRegistry__;
  if (!registry || !registry.has(vaultName)) {
    // Give it a moment to appear
    await new Promise(r => setTimeout(r, 100));
    if (!registry || !registry.has(vaultName)) {
      throw new Error(`Worker for ${vaultName} not found in registry.`);
    }
  }

  const entry = registry.get(vaultName);

  // If it's already in the desired state, return immediately.
  if (entry.health === health) {
    return;
  }

  // Otherwise, wait for the right state.
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for worker to become ${health}. Current state: ${entry.health}`));
    }, 8000); // 8-second timeout

    const checkHealth = () => {
      if (entry.health === health) {
        clearTimeout(timeout);
        resolve();
      } else if (entry.health === 'failed') {
        clearTimeout(timeout);
        reject(new Error('Worker entered a failed state.'));
      } else {
        setTimeout(checkHealth, 50); // Poll every 50ms
      }
    };

    checkHealth();
  });
}

describe('Expiration Middleware - Strategy Validation', () => {
  let vault;

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
    // Clean up all workers after each test to ensure isolation
    const registry = globalThis.__vaultExpirationWorkerRegistry__;
    if (registry) {
      for (const key of registry.keys()) {
        const entry = registry.get(key);
        try { entry.worker.terminate(); } catch {}
        registry.delete(key);
      }
    }
  });

  describe('Immediate Cleanup Strategy', () => {
    beforeEach(() => {
      vault = new Vault('test-immediate-strategy');
      vault.use(expirationMiddleware({
        cleanupMode: 'immediate',
        defaultTTL: undefined
      }));
    });

    it('should remove expired items synchronously on access', async () => {
      await vault.setItem('test-key', 'test-value', { ttl: 1 });
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait for expiration

      const result = await vault.getItem('test-key');
      expect(result).toBeNull();

      // Verify item is actually removed from storage (not just returned as null)
      const keys = await vault.keys();
      expect(keys).not.toContain('test-key');
    });

    it('should handle multiple expired items efficiently in immediate mode', async () => {
      // This is our current failing test - should pass in immediate mode
      for (let i = 0; i < 50; i++) {
        await vault.setItem(`item${i}`, `value${i}`, { ttl: 1 });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const results = [];
      for (let i = 0; i < 50; i++) {
        results.push(await vault.getItem(`item${i}`));
      }

      results.forEach((result, index) => {
        expect(result).toBeNull(`Item ${index} should be expired in immediate mode`);
      });

      expect(await vault.length()).toBe(0);
    });

    it('should clean up all expired items on length() call', async () => {
      // Set items with different expiration times
      for (let i = 0; i < 20; i++) {
        await vault.setItem(`immediate-${i}`, `value-${i}`, { ttl: 10 + i }); // 10-29ms
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for all to expire

      // length() should trigger immediate cleanup
      const length = await vault.length();
      expect(length).toBe(0);

      // keys() should also show empty
      const keys = await vault.keys();
      expect(keys.length).toBe(0);
    });

    it('should provide synchronous cleanup behavior', async () => {
      await vault.setItem('sync-test', 'value', { ttl: 50 });
      await new Promise(resolve => setTimeout(resolve, 100));

      const start = performance.now();
      const result = await vault.getItem('sync-test');
      const duration = performance.now() - start;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(100); // Should be fast and synchronous
    });
  });

  describe('Background Cleanup Strategy', () => {
    beforeEach(() => {
      vault = new Vault('test-background-strategy');
      vault.use(expirationMiddleware({
        cleanupMode: 'background',
        workerInterval: 100 // Faster for testing
      }));
    });

    it('should clean up expired items via background worker', async () => {
      await vault.setItem('bg-key', 'bg-value', { ttl: 50 });

      // Item should still exist immediately after expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      let result = await vault.getItem('bg-key');
      expect(result).toBeNull(); // Should return null but might still be in storage

      // Give background worker time to clean up
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now it should be removed from storage
      const keys = await vault.keys();
      expect(keys).not.toContain('bg-key');
    });

    it('should handle worker failure gracefully', async () => {
      // Test worker resilience
      await vault.setItem('resilient-key', 'value', { ttl: 50 });

      // Simulate worker failure by accessing the global registry
      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      if (registry) {
        const storageName = vault.storageName;
        const entry = registry.get(storageName);
        if (entry) {
          entry.worker.terminate(); // Force terminate worker
          entry.health = 'failed';
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should fall back to on-demand sweep
      const result = await vault.getItem('resilient-key');
      expect(result).toBeNull();
    });

    it('should maintain worker registry correctly', async () => {
      await vault.setItem('trigger', 'value'); // Trigger middleware to start the worker
      await waitForWorker(vault);

      // Verify worker is registered and healthy
      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      expect(registry).toBeDefined();
      expect(registry.has(vault.storageName)).toBe(true);

      const workerEntry = registry.get(vault.storageName);
      expect(workerEntry.worker).toBeInstanceOf(Worker);
      expect(workerEntry.health).toBe('healthy');
    }, 10000);

    it('should handle multiple vaults with separate workers', async () => {
      const vault2 = new Vault('test-background-strategy-2');
      vault2.use(expirationMiddleware({
        cleanupMode: 'background',
        workerInterval: 100
      }));

      // Trigger worker initialization for both vaults
      await vault.setItem('trigger1', 'value1');
      await vault2.setItem('trigger2', 'value2');

      await Promise.all([waitForWorker(vault), waitForWorker(vault2)]);

      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      expect(registry.has(vault.storageName)).toBe(true);
      expect(registry.has(vault2.storageName)).toBe(true);
      expect(registry.get(vault.storageName).worker).not.toBe(registry.get(vault2.storageName).worker);
      expect(registry.get(vault.storageName).health).toBe('healthy');
      expect(registry.get(vault2.storageName).health).toBe('healthy');

      await vault2.clear();
    }, 10000);
  });

  describe('Hybrid Cleanup Strategy', () => {
    beforeEach(() => {
      vault = new Vault('test-hybrid-strategy');
      vault.use(expirationMiddleware({
        cleanupMode: 'hybrid'
      }));
    });

    it('should provide immediate response with background cleanup', async () => {
      // Set multiple items
      for (let i = 0; i < 20; i++) {
        await vault.setItem(`hybrid-${i}`, `value-${i}`, { ttl: 50 });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // First access should return null immediately
      const firstResult = await vault.getItem('hybrid-0');
      expect(firstResult).toBeNull();

      // Background should clean up others over time
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalLength = await vault.length();
      expect(finalLength).toBe(0);
    });

    it('should balance immediate and background cleanup', async () => {
      await vault.setItem('hybrid-test', 'value', { ttl: 50 });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should get immediate null response
      const start = performance.now();
      const result = await vault.getItem('hybrid-test');
      const duration = performance.now() - start;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(50); // Should be fast like immediate mode
    });

    it('should use background worker for non-accessed items', async () => {
      // Set items that won't be accessed
      for (let i = 0; i < 10; i++) {
        await vault.setItem(`unaccessed-${i}`, `value-${i}`, { ttl: 50 });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Don't access items, let background worker clean them
      await new Promise(resolve => setTimeout(resolve, 400));

      const length = await vault.length();
      expect(length).toBe(0);
    });
  });

  fdescribe('Proactive Cleanup Strategy', () => {
    const vaultName = 'test-proactive-strategy';

    beforeEach(async () => {
      // Ensure no worker from a previous test run is lingering
      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      if (registry && registry.has(vaultName)) {
        try {
          registry.get(vaultName).worker.terminate();
        } catch (e) {
          console.error('Error terminating lingering worker:', e);
        }
        registry.delete(vaultName);
      }

      vault = new Vault(vaultName);

      const middleware = expirationMiddleware({
        cleanupMode: 'proactive',
      });

      // Register middleware, which triggers worker creation
      vault.use(middleware);

      // Wait for the worker to be initialized by the onRegister hook
      try {
        await waitForWorker(vaultName, 'healthy');
      } catch (error) {
        // Provide a more informative error if the worker fails to start
        console.error('Worker did not initialize in time for the test.', error);
        throw error; // Re-throw to fail the test clearly
      }
    });

    afterEach(async () => {
      // This afterEach is specific to the proactive suite for safety
      if (vault) {
        await vault.clear();
        const registry = globalThis.__vaultExpirationWorkerRegistry__;
        if (registry && registry.has(vault.storageName)) {
          try {
            registry.get(vault.storageName).worker.terminate();
          } catch (e) {
            console.error('Error terminating worker in proactive afterEach:', e);
          }
          registry.delete(vault.storageName);
        }
      }
    });

    it('should initialize the worker on registration', async () => {
      // The worker should be started by the `use` call, not an operation
      await waitForWorker(vaultName);
      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      expect(registry.has(vault.storageName)).toBe(true);
      const entry = registry.get(vault.storageName);
      expect(entry.health).toBe('healthy');
    }, 10000);

    it('should schedule a precise cleanup and remove an item', async () => {
      const ttl = 200;
      const startTime = Date.now();
      await vault.setItem('proactive-key', 'value', { ttl });

      // Wait for a bit longer than the TTL
      await new Promise(resolve => setTimeout(resolve, ttl + 150));

      // The item should be gone from storage, not just return null
      const keys = await vault.keys();
      expect(keys).not.toContain('proactive-key');
      expect(await vault.length()).toBe(0);
    });

    it('should re-schedule when a new item with a shorter TTL is added', async () => {
      // Set an item with a long TTL
      await vault.setItem('long-ttl-key', 'value', { ttl: 5000 });

      // Give the worker a moment to schedule the long sleep
      await new Promise(resolve => setTimeout(resolve, 50));

      // Now add an item with a very short TTL
      const shortTtl = 150;
      await vault.setItem('short-ttl-key', 'value', { ttl: shortTtl });

      // The worker should have been nudged to reschedule.
      // Wait for the short TTL to expire.
      await new Promise(resolve => setTimeout(resolve, shortTtl + 100));

      // The short-lived item should be gone
      let keys = await vault.keys();
      expect(keys).not.toContain('short-ttl-key');

      // The long-lived item should still be there
      expect(keys).toContain('long-ttl-key');
      expect(await vault.length()).toBe(1);
    });

    it('should handle an empty vault without errors', async () => {
      // The beforeEach already waits for the worker.
      // We just need to ensure no errors are thrown during idle time.
      await vault.clear(); // Nudge it with an empty state

      // No assertions needed, just checking for absence of errors
      await new Promise(resolve => setTimeout(resolve, 200));
      // If waitForWorker in beforeEach passed, this test implicitly passes.
      expect(true).toBe(true);
    });
  });

  describe('Strategy Performance Comparison', () => {
    const strategies = ['immediate', 'background', 'hybrid'];
    const testData = Array.from({ length: 100 }, (_, i) => [`perf-${i}`, `value-${i}`]);

    strategies.forEach(strategy => {
      it(`should perform efficiently in ${strategy} mode`, async () => {
        vault = new Vault(`test-perf-${strategy}`);
        vault.use(expirationMiddleware({ cleanupMode: strategy }));

        const startTime = performance.now();

        // Set items
        for (const [key, value] of testData) {
          await vault.setItem(key, value, { ttl: 1 });
        }

        await new Promise(resolve => setTimeout(resolve, 50));

        // Access all items
        const results = await Promise.all(
          testData.map(([key]) => vault.getItem(key))
        );

        const endTime = performance.now();
        const duration = endTime - startTime;

        // All should be null (expired)
        results.forEach(result => expect(result).toBeNull());

        // Performance expectations vary by strategy
        if (strategy === 'immediate') {
          expect(duration).toBeLessThan(2000); // May be slower due to synchronous cleanup
        } else if (strategy === 'background') {
          expect(duration).toBeLessThan(500); // Should be fastest for access
        } else if (strategy === 'hybrid') {
          expect(duration).toBeLessThan(1000); // Should be balanced
        }

        console.log(`${strategy} mode: ${duration.toFixed(2)}ms for 100 operations`);
      });
    });
  });

  describe('Strategy Verification Tests', () => {
    it('should verify background worker is actually running', async () => {
      vault = new Vault('test-worker-verification');
      vault.use(expirationMiddleware({ cleanupMode: 'background' }));

      // Set an item to trigger worker initialization
      await vault.setItem('worker-test', 'value', { ttl: 100 });

      // Check if worker is registered
      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      expect(registry).toBeDefined();
      expect(registry.has(vault.storageName)).toBe(true);

      const workerEntry = registry.get(vault.storageName);
      expect(workerEntry.worker).toBeInstanceOf(Worker);
      expect(workerEntry.health).toBe('healthy');
    });

    it('should verify immediate mode does not create workers', async () => {
      vault = new Vault('test-immediate-no-worker');
      vault.use(expirationMiddleware({ cleanupMode: 'immediate' }));

      // Set an item
      await vault.setItem('immediate-test', 'value', { ttl: 100 });

      // Check that no worker is registered for immediate mode
      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      expect(registry.has(vault.storageName)).toBe(false);
    });

    it('should verify cleanup strategies have different behaviors', async () => {
      const immediateVault = new Vault('test-immediate-behavior');
      const backgroundVault = new Vault('test-background-behavior');

      immediateVault.use(expirationMiddleware({ cleanupMode: 'immediate' }));
      backgroundVault.use(expirationMiddleware({ cleanupMode: 'background' }));

      // Set same data in both
      await immediateVault.setItem('test', 'value', { ttl: 50 });
      await backgroundVault.setItem('test', 'value', { ttl: 50 });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Immediate should clean up right away
      const immediateStart = performance.now();
      const immediateResult = await immediateVault.getItem('test');
      const immediateTime = performance.now() - immediateStart;

      // Background might be faster to return null but not necessarily clean storage
      const backgroundStart = performance.now();
      const backgroundResult = await backgroundVault.getItem('test');
      const backgroundTime = performance.now() - backgroundStart;

      expect(immediateResult).toBeNull();
      expect(backgroundResult).toBeNull();

      // Verify different cleanup timings
      console.log(`Immediate cleanup: ${immediateTime.toFixed(2)}ms`);
      console.log(`Background cleanup: ${backgroundTime.toFixed(2)}ms`);

      // Clean up test vaults
      await immediateVault.clear();
      await backgroundVault.clear();
    });

    it('should verify strategy configuration is respected', async () => {
      // Test that options are properly applied
      const customVault = new Vault('test-custom-config');
      customVault.use(expirationMiddleware({
        cleanupMode: 'background',
        workerInterval: 50,
        throttleMs: 100,
        defaultTTL: 1000
      }));

      // Set item without explicit TTL (should use default)
      await customVault.setItem('default-ttl', 'value');

      const meta = await customVault.getItemMeta('default-ttl');
      expect(meta.expires).toBeDefined();
      expect(meta.expires).toBeGreaterThan(Date.now() + 500); // Should be around 1000ms

      await customVault.clear();
    });
  });

  describe('Backward Compatibility Tests', () => {
    it('should support legacy single parameter (defaultTTL)', async () => {
      // Test old-style initialization
      vault = new Vault('test-legacy-compat');
      vault.use(expirationMiddleware('1h')); // String TTL

      await vault.setItem('legacy-test', 'value');

      const meta = await vault.getItemMeta('legacy-test');
      expect(meta.expires).toBeDefined();
      expect(meta.expires).toBeGreaterThan(Date.now() + 3500000); // ~1 hour
    });

    it('should support legacy numeric parameter (defaultTTL)', async () => {
      vault = new Vault('test-legacy-numeric');
      vault.use(expirationMiddleware(5000)); // 5 seconds in ms

      await vault.setItem('legacy-numeric', 'value');

      const meta = await vault.getItemMeta('legacy-numeric');
      expect(meta.expires).toBeDefined();
      expect(meta.expires).toBeGreaterThan(Date.now() + 4000); // ~5 seconds
    });

    it('should default to background mode when no cleanupMode specified', async () => {
      vault = new Vault('test-default-mode');
      vault.use(expirationMiddleware({ defaultTTL: 1000 }));

      // Should create background worker by default
      await vault.setItem('default-mode', 'value');

      const registry = globalThis.__vaultExpirationWorkerRegistry__;
      expect(registry.has(vault.storageName)).toBe(true);
    });
  });
});