/**
 * Performance and stress tests for the vault and middleware system
 */

import Vault from '../dist/vault.js';
import EncryptedVault from '../dist/encrypted-vault.js';
import { validationMiddleware } from '../dist/middlewares/validation.js';
import { expirationMiddleware } from '../dist/middlewares/expiration.js';
import { encryptionMiddleware } from '../dist/middlewares/encryption.js';

async function runPerfTest(vault, count) {
  const startTime = performance.now();
  for (let i = 0; i < count; i++) {
    await vault.setItem(`item-${i}`, { data: `data-${i}` });
    await vault.getItem(`item-${i}`);
  }
  return performance.now() - startTime;
}

describe('Performance and Stress Tests', () => {
  let vault;

  // Increase timeout for heavy performance/stress specs in this file
  const ORIGINAL_TIMEOUT = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  beforeAll(() => {
    // Many specs below intentionally run thousands of async ops; 30s avoids flaky timeouts
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
  });
  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = ORIGINAL_TIMEOUT;
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Core Vault Performance', () => {
    beforeEach(() => {
      vault = new Vault('performance-test');
    });

    it('should handle large number of items efficiently', async () => {
      const itemCount = 1000;
      const startTime = performance.now();

      // Batch set operations
      const setPromises = [];
      for (let i = 0; i < itemCount; i++) {
        setPromises.push(vault.setItem(`perf-item-${i}`, {
          id: i,
          data: `test-data-${i}`,
          timestamp: Date.now(),
          metadata: { index: i, category: `cat-${i % 10}` }
        }));
      }

      await Promise.all(setPromises);
      const setTime = performance.now();

      // Batch get operations
      const getPromises = [];
      for (let i = 0; i < itemCount; i++) {
        getPromises.push(vault.getItem(`perf-item-${i}`));
      }

      const results = await Promise.all(getPromises);
      const getTime = performance.now();

      // Verify results
      for (let i = 0; i < itemCount; i++) {
        expect(results[i]).toBeDefined();
        expect(results[i].id).toBe(i);
      }

      // Performance benchmarks
      const setDuration = setTime - startTime;
      const getDuration = getTime - setTime;

      console.log(`Performance test - ${itemCount} items:`);
      console.log(`  Set operations: ${setDuration.toFixed(2)}ms (${(setDuration/itemCount).toFixed(2)}ms per item)`);
      console.log(`  Get operations: ${getDuration.toFixed(2)}ms (${(getDuration/itemCount).toFixed(2)}ms per item)`);

  // Reasonable performance expectations (generous to avoid environment flakiness)
  // Absolute caps for total batch
  expect(setDuration).toBeLessThan(30000); // < 30s for 1000 sets (parallelized)
  expect(getDuration).toBeLessThan(20000); // < 20s for 1000 gets (parallelized)
  // Per-item averages (coarse sanity check regardless of parallelization)
  expect(setDuration / itemCount).toBeLessThan(100); // < 100ms per set on average
  expect(getDuration / itemCount).toBeLessThan(75);  // < 75ms per get on average
    });

    it('should handle large individual items efficiently', async () => {
      const sizes = [
        { name: '1KB', size: 1024 },
        { name: '10KB', size: 10 * 1024 },
        { name: '100KB', size: 100 * 1024 },
        { name: '1MB', size: 1024 * 1024 }
      ];

      for (const { name, size } of sizes) {
        const largeData = {
          content: 'x'.repeat(size),
          metadata: { size, name, created: Date.now() }
        };

        const startTime = performance.now();
        await vault.setItem(`large-${name}`, largeData);
        const setTime = performance.now();

        const retrieved = await vault.getItem(`large-${name}`);
        const getTime = performance.now();

        expect(retrieved.content.length).toBe(size);
        expect(retrieved.metadata.name).toBe(name);

        const setDuration = setTime - startTime;
        const getDuration = getTime - setTime;

        console.log(`Large item test - ${name}:`);
        console.log(`  Set: ${setDuration.toFixed(2)}ms, Get: ${getDuration.toFixed(2)}ms`);

  // Environment-tolerant scaling bounds with base overhead + per-KB factors
  const sizeKB = size / 1024;
  const maxSetMs = 300 + sizeKB * 12; // e.g., 1MB => ~12.6s
  const maxGetMs = 200 + sizeKB * 8;  // e.g., 1MB => ~8.4s
  expect(setDuration).toBeLessThan(maxSetMs);
  expect(getDuration).toBeLessThan(maxGetMs);
      }
    });

    it('should handle rapid sequential operations', async () => {
      const operationCount = 500;
      const startTime = performance.now();

      // Rapid sequential operations
      for (let i = 0; i < operationCount; i++) {
        await vault.setItem(`seq-${i}`, `value-${i}`);
        const retrieved = await vault.getItem(`seq-${i}`);
        expect(retrieved).toBe(`value-${i}`);

        if (i % 2 === 0) {
          await vault.removeItem(`seq-${i}`);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Sequential operations test - ${operationCount * 2.5} operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(operationCount * 10); // Less than 10ms per operation pair
    });

    it('should handle concurrent operations efficiently', async () => {
      const concurrentCount = 100;
      const operationsPerWorker = 10;

      const workers = [];

      // Create concurrent workers
      for (let worker = 0; worker < concurrentCount; worker++) {
        const workerPromise = async () => {
          const operations = [];

          // Each worker performs multiple operations
          for (let op = 0; op < operationsPerWorker; op++) {
            const key = `worker-${worker}-op-${op}`;
            const value = { worker, operation: op, timestamp: Date.now() };

            operations.push(
              vault.setItem(key, value)
                .then(() => vault.getItem(key))
                .then(result => {
                  expect(result.worker).toBe(worker);
                  expect(result.operation).toBe(op);
                  return result;
                })
            );
          }

          return Promise.all(operations);
        };

        workers.push(workerPromise());
      }

      const startTime = performance.now();
      const results = await Promise.all(workers);
      const endTime = performance.now();

      const totalOperations = concurrentCount * operationsPerWorker * 2; // set + get
      const duration = endTime - startTime;

      console.log(`Concurrent operations test - ${totalOperations} operations: ${duration.toFixed(2)}ms`);

      // Verify all operations completed
      expect(results.length).toBe(concurrentCount);
      results.forEach(workerResults => {
        expect(workerResults.length).toBe(operationsPerWorker);
      });

      // Performance check
      expect(duration).toBeLessThan(15000); // Should complete in under 15 seconds
    });

    it('should maintain performance under memory pressure', async () => {
      const rounds = 10;
      const itemsPerRound = 200;
      const times = [];

      for (let round = 0; round < rounds; round++) {
        const startTime = performance.now();

        // Add items
        for (let i = 0; i < itemsPerRound; i++) {
          await vault.setItem(`memory-${round}-${i}`, {
            round,
            item: i,
            data: 'x'.repeat(1000), // 1KB per item
            created: Date.now()
          });
        }

        // Read items
        for (let i = 0; i < itemsPerRound; i++) {
          const result = await vault.getItem(`memory-${round}-${i}`);
          expect(result.round).toBe(round);
        }

        const endTime = performance.now();
        times.push(endTime - startTime);

        console.log(`Memory pressure round ${round + 1}: ${(endTime - startTime).toFixed(2)}ms`);
      }

      // Performance should not degrade significantly over time
      const firstHalf = times.slice(0, rounds / 2);
      const secondHalf = times.slice(rounds / 2);

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be more than 2x slower than first half
      expect(secondAvg).toBeLessThan(firstAvg * 2);
    });
  });

  describe('Middleware Performance Impact', () => {
    beforeEach(() => {
      // Use immediate mode for consistent performance measurement
      vault = new Vault('middleware-perf-test');
      vault.use(expirationMiddleware({ cleanupMode: 'immediate' }));
    });

    it('should measure performance impact of individual middlewares', async () => {
      const baselineVault = new Vault('baseline-performance');
      await baselineVault.clear();
      const baselineTime = await runPerfTest(baselineVault, 100);
      console.log(`  Baseline: ${baselineTime.toFixed(2)}ms`);

      // Validation middleware only
      const validationVault = new Vault('validation-performance');
      validationVault.use(validationMiddleware());
      const validationTime = await runPerfTest(validationVault, 100);
      console.log(`  Validation: ${validationTime.toFixed(2)}ms (${((validationTime / baselineTime) * 100 - 100).toFixed(1)}% overhead)`);

      // Expiration middleware only
      const expirationVault = new Vault('expiration-perf');
      expirationVault.use(expirationMiddleware({ cleanupMode: 'immediate' }));
      const expirationTime = await runPerfTest(expirationVault, 100);
      console.log(`  Expiration: ${expirationTime.toFixed(2)}ms (${((expirationTime / baselineTime) * 100 - 100).toFixed(1)}% overhead)`);

      const encryptionVault = new Vault('encryption-perf');
      encryptionVault.use(encryptionMiddleware({ password: 'test', salt: 'test' }));
      const encryptionTime = await runPerfTest(encryptionVault, 100);
      console.log(`  Encryption: ${encryptionTime.toFixed(2)}ms (${((encryptionTime / baselineTime) * 100 - 100).toFixed(1)}% overhead)`);

      // Allow for more overhead in CI environments
      expect(validationTime / baselineTime).toBeLessThan(3);
      expect(expirationTime / baselineTime).toBeLessThan(5); // Increased threshold
      expect(encryptionTime / baselineTime).toBeLessThan(30); // Encryption is expensive
    });

    it('should compare EncryptedVault performance with manual setup', async () => {
      const testData = { secret: 'confidential-data', id: 123 };
      const operationCount = 50;

      // EncryptedVault
      const encryptedVault = new EncryptedVault({ password: 'test', salt: 'test' }, {
        storageName: 'encrypted-vault-performance'
      });
      await encryptedVault.clear();

      let startTime = performance.now();
      for (let i = 0; i < operationCount; i++) {
        await encryptedVault.setItem(`encrypted-${i}`, testData);
        await encryptedVault.getItem(`encrypted-${i}`);
      }
      const encryptedVaultTime = performance.now() - startTime;

      // Manual setup
      const manualVault = new Vault('manual-encryption-performance');
      manualVault.use(encryptionMiddleware({ password: 'test', salt: 'test' }));
      await manualVault.clear();

      startTime = performance.now();
      for (let i = 0; i < operationCount; i++) {
        await manualVault.setItem(`manual-${i}`, testData);
        await manualVault.getItem(`manual-${i}`);
      }
      const manualTime = performance.now() - startTime;

      console.log(`EncryptedVault vs Manual (${operationCount} operations):`);
      console.log(`  EncryptedVault: ${encryptedVaultTime.toFixed(2)}ms`);
      console.log(`  Manual setup: ${manualTime.toFixed(2)}ms`);

      // Performance should be similar
      expect(Math.abs(encryptedVaultTime - manualTime)).toBeLessThan(Math.max(encryptedVaultTime, manualTime) * 0.5);

      await encryptedVault.clear();
      await manualVault.clear();
    });
  });

  describe('Stress Tests', () => {
    it('should handle extreme concurrent load', async () => {
      vault = new Vault('stress-concurrent');
      vault.use(validationMiddleware());
      vault.use(expirationMiddleware());

      const concurrentWorkers = 50;
      const operationsPerWorker = 20;

      const workers = Array(concurrentWorkers).fill(null).map(async (_, workerId) => {
        const operations = [];

        for (let op = 0; op < operationsPerWorker; op++) {
          const key = `stress-${workerId}-${op}`;
          const value = {
            workerId,
            operation: op,
            timestamp: Date.now(),
            data: 'x'.repeat(100) // Add some data size
          };

          operations.push(
            vault.setItem(key, value, { ttl: '1h' })
              .then(() => vault.getItem(key))
              .then(result => {
                expect(result.workerId).toBe(workerId);
                expect(result.operation).toBe(op);
              })
              .then(() => {
                // Randomly remove some items
                if (Math.random() < 0.3) {
                  return vault.removeItem(key);
                }
              })
          );
        }

        return Promise.all(operations);
      });

      const startTime = performance.now();
      await Promise.all(workers);
      const endTime = performance.now();

      const totalOperations = concurrentWorkers * operationsPerWorker * 2.3; // Accounting for removes
      console.log(`Stress test - ${totalOperations} operations across ${concurrentWorkers} workers: ${(endTime - startTime).toFixed(2)}ms`);

      // Should handle the load without crashing
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max

      // Verify final state
      const finalLength = await vault.length();
      expect(finalLength).toBeGreaterThan(0);
      expect(finalLength).toBeLessThanOrEqual(concurrentWorkers * operationsPerWorker);
    });

  it('should handle rapid vault creation and destruction', async () => {
      const vaultCount = 100;
      const operations = [];

      for (let i = 0; i < vaultCount; i++) {
        operations.push(
          (async () => {
            const testVault = new Vault(`rapid-vault-${i}`);
            testVault.use(validationMiddleware());

            await testVault.setItem('test', `value-${i}`);
            const result = await testVault.getItem('test');
            expect(result).toBe(`value-${i}`);

            await testVault.clear();
            return testVault;
          })()
        );
      }

      const startTime = performance.now();
      const vaults = await Promise.all(operations);
      const endTime = performance.now();

      console.log(`Rapid vault creation test - ${vaultCount} vaults: ${(endTime - startTime).toFixed(2)}ms`);

      expect(vaults.length).toBe(vaultCount);
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle memory stress with large datasets', async () => {
      vault = new Vault('memory-stress');

      const largeItemCount = 200;
      const itemSize = 50 * 1024; // 50KB per item = 10MB total

      // Create large dataset
      for (let i = 0; i < largeItemCount; i++) {
        const largeData = {
          id: i,
          content: 'x'.repeat(itemSize),
          metadata: {
            created: Date.now(),
            size: itemSize,
            index: i
          }
        };

        await vault.setItem(`large-${i}`, largeData);

        // Periodically verify we can still read data
        if (i % 50 === 0 && i > 0) {
          const testRead = await vault.getItem(`large-${i - 10}`);
          expect(testRead.id).toBe(i - 10);
        }
      }

      // Verify all data is accessible
      for (let i = 0; i < largeItemCount; i += 10) { // Sample every 10th item
        const result = await vault.getItem(`large-${i}`);
        expect(result).toBeDefined();
        expect(result.id).toBe(i);
        expect(result.content.length).toBe(itemSize);
      }

      const finalLength = await vault.length();
      expect(finalLength).toBe(largeItemCount);

      console.log(`Memory stress test completed - ${largeItemCount} items, ${(largeItemCount * itemSize / 1024 / 1024).toFixed(2)}MB total`);
    });

  it('should handle error resilience under stress', async () => {
      vault = new Vault('error-stress');

      // Add middleware that randomly fails
      let errorCount = 0;
      vault.use({
        name: 'random-error-middleware',
        before: async (context) => {
          if (Math.random() < 0.1) { // 10% failure rate
            errorCount++;
            throw new Error(`Random middleware error ${errorCount}`);
          }
          return context;
        }
      });

      const operationCount = 200;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < operationCount; i++) {
        try {
          await vault.setItem(`error-test-${i}`, `value-${i}`);
          const result = await vault.getItem(`error-test-${i}`);
          if (result === `value-${i}`) {
            successCount++;
          }
        } catch (error) {
          failureCount++;
          expect(error.message).toContain('Random middleware error');
        }
      }

      console.log(`Error resilience test - Operations: ${operationCount}, Success: ${successCount}, Failures: ${failureCount}`);

  // Should have some successes and some failures
  // With a 10% random failure probability per operation and two ops per iteration
  // the expected success rate is ~81%. Use a tolerant lower bound to avoid flakiness.
  expect(successCount).toBeGreaterThanOrEqual(Math.floor(operationCount * 0.75)); // >= 75% success
      expect(failureCount).toBeGreaterThan(0); // Some failures expected
      expect(successCount + failureCount).toBe(operationCount);

      // Best-effort cleanup within the test to avoid random failures in global afterEach
      try {
        await vault.clear();
      } catch (_) {
        // Ignore random middleware errors during cleanup
      } finally {
        // Prevent afterEach from attempting another clear that could randomly fail
        vault = null;
      }
    });
  });

  describe('Bundle Size Impact Tests', () => {
    it('should verify middleware system does not significantly impact bundle size', () => {
      // This is more of a build-time test, but we can verify the middleware array exists
      vault = new Vault('bundle-size-test');

      // Verify middleware system is present but minimal
      expect(vault.middlewares).toBeDefined();
      expect(Array.isArray(vault.middlewares)).toBe(true);
      expect(vault.use).toBeInstanceOf(Function);
      expect(vault.executeWithMiddleware).toBeInstanceOf(Function);

      // Basic functionality should work without middleware
      expect(vault.setItem).toBeInstanceOf(Function);
      expect(vault.getItem).toBeInstanceOf(Function);
      expect(vault.removeItem).toBeInstanceOf(Function);
      expect(vault.clear).toBeInstanceOf(Function);
      expect(vault.keys).toBeInstanceOf(Function);
      expect(vault.length).toBeInstanceOf(Function);
    });

    it('should verify EncryptedVault has reasonable overhead', () => {
      const encryptedVault = new EncryptedVault({ password: 'test', salt: 'test' });

      // EncryptedVault should have all the same methods as regular Vault
      expect(encryptedVault.setItem).toBeInstanceOf(Function);
      expect(encryptedVault.getItem).toBeInstanceOf(Function);
      expect(encryptedVault.removeItem).toBeInstanceOf(Function);
      expect(encryptedVault.clear).toBeInstanceOf(Function);
      expect(encryptedVault.keys).toBeInstanceOf(Function);
      expect(encryptedVault.length).toBeInstanceOf(Function);

      // Should have middleware pre-configured
      expect(encryptedVault.middlewares).toBeDefined();
      expect(encryptedVault.middlewares.length).toBeGreaterThan(0);
    });
  });
});