/**
 * Vault Events System Test Suite
 *
 * Tests the event emission system for vault operations.
 * Covers addEventListener, removeEventListener, dispatchEvent, and onchange handler.
 */

import Vault from '../dist/vault.js';

describe('Vault Events System', () => {
  let vault;

  beforeEach(async () => {
    vault = new Vault(`test-events-${Date.now()}-${Math.random()}`);
    await vault.clear();
  });

  afterEach(async () => {
    if (vault) {
      try {
        await vault.clear();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ===== BASIC EVENT EMISSION =====

  describe('Basic Event Emission', () => {
    it('should emit "change" event on setItem operation', async () => {
      let eventReceived = false;
      let eventData = null;

      vault.addEventListener('change', (event) => {
        eventReceived = true;
        eventData = event.detail;
      });

      await vault.setItem('test-key', 'test-value', { ttl: 3600 });

      expect(eventReceived).toBe(true);
      expect(eventData).toEqual(jasmine.objectContaining({
        op: 'set',
        key: 'test-key',
        meta: { ttl: 3600 }
      }));
      expect(eventData.version).toEqual(jasmine.any(Number));
    });

    it('should emit "change" event on removeItem operation', async () => {
      await vault.setItem('remove-key', 'remove-value', { custom: 'data' });

      let eventReceived = false;
      let eventData = null;

      vault.addEventListener('change', (event) => {
        eventReceived = true;
        eventData = event.detail;
      });

      await vault.removeItem('remove-key');

      expect(eventReceived).toBe(true);
      expect(eventData).toEqual(jasmine.objectContaining({
        op: 'remove',
        key: 'remove-key',
        meta: { custom: 'data' }
      }));
    });

    it('should emit "change" event on clear operation', async () => {
      await vault.setItem('key1', 'value1');
      await vault.setItem('key2', 'value2');

      let eventReceived = false;
      let eventData = null;

      vault.addEventListener('change', (event) => {
        eventReceived = true;
        eventData = event.detail;
      });

      await vault.clear();

      expect(eventReceived).toBe(true);
      expect(eventData.op).toBe('clear');
      expect(eventData.key).toBeUndefined();
      expect(eventData.meta).toBeUndefined();
      expect(eventData.version).toEqual(jasmine.any(Number));
    });

    it('should NOT emit events for read operations', async () => {
      await vault.setItem('get-key', 'get-value');

      let eventReceived = false;
      vault.addEventListener('change', () => {
        eventReceived = true;
      });

      await vault.getItem('get-key');
      await vault.getItem('non-existent-key');
      await vault.keys();
      await vault.length();
      await vault.getItemMeta('get-key');

      expect(eventReceived).toBe(false);
    });

    it('should NOT emit events when operations fail', async () => {
      let eventReceived = false;

      vault.addEventListener('change', () => {
        eventReceived = true;
      });

      // Test with invalid key (should cause validation error)
      try {
        await vault.setItem('', 'empty-key-value');
      } catch (e) {
        // Expected to fail
      }

      try {
        await vault.setItem(null, 'null-key-value');
      } catch (e) {
        // Expected to fail
      }

      expect(eventReceived).toBe(false);
    });
  });

  // ===== EVENT LISTENER MANAGEMENT =====

  describe('Event Listener Management', () => {
    it('should support multiple event listeners', async () => {
      let listener1Called = false;
      let listener2Called = false;
      let listener3Called = false;

      vault.addEventListener('change', () => { listener1Called = true; });
      vault.addEventListener('change', () => { listener2Called = true; });
      vault.addEventListener('change', () => { listener3Called = true; });

      await vault.setItem('multi-key', 'value');

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
      expect(listener3Called).toBe(true);
    });

    it('should correctly remove specific event listeners', async () => {
      let listener1Called = false;
      let listener2Called = false;

      const listener1 = () => { listener1Called = true; };
      const listener2 = () => { listener2Called = true; };

      vault.addEventListener('change', listener1);
      vault.addEventListener('change', listener2);
      vault.removeEventListener('change', listener1);

      await vault.setItem('remove-listener-key', 'value');

      expect(listener1Called).toBe(false);
      expect(listener2Called).toBe(true);
    });

    it('should handle removing non-existent listeners gracefully', () => {
      const nonExistentListener = () => {};

      expect(() => {
        vault.removeEventListener('change', nonExistentListener);
      }).not.toThrow();

      expect(() => {
        vault.removeEventListener('non-existent-event', nonExistentListener);
      }).not.toThrow();
    });

    it('should support "once" option for event listeners', async () => {
      let callCount = 0;

      vault.addEventListener('change', () => { callCount++; }, { once: true });

      await vault.setItem('once-key1', 'value1');
      await vault.setItem('once-key2', 'value2');

      expect(callCount).toBe(1);
    });
  });

  // ===== ONCHANGE PROPERTY HANDLER =====

  describe('onchange Property Handler', () => {
    it('should call onchange handler when events are emitted', async () => {
      let onchangeCalled = false;
      let onchangeData = null;

      vault.onchange = (event) => {
        onchangeCalled = true;
        onchangeData = event.detail;
      };

      await vault.setItem('onchange-key', 'onchange-value');

      expect(onchangeCalled).toBe(true);
      expect(onchangeData).toEqual(jasmine.objectContaining({
        op: 'set',
        key: 'onchange-key'
      }));
    });

    it('should handle errors in onchange handler gracefully', async () => {
      vault.onchange = () => {
        throw new Error('Intentional error in onchange');
      };

      // Should not throw or prevent normal operation
      await expectAsync(vault.setItem('error-key', 'error-value')).toBeResolved();

      // Verify the item was still stored despite the onchange error
      const value = await vault.getItem('error-key');
      expect(value).toBe('error-value');
    });

    it('should work alongside regular event listeners', async () => {
      let onchangeCalled = false;
      let listenerCalled = false;

      vault.onchange = () => { onchangeCalled = true; };
      vault.addEventListener('change', () => { listenerCalled = true; });

      await vault.setItem('both-key', 'both-value');

      expect(onchangeCalled).toBe(true);
      expect(listenerCalled).toBe(true);
    });

    it('should handle onchange being set to null', async () => {
      vault.onchange = () => { throw new Error('Should not be called'); };
      vault.onchange = null;

      await expectAsync(vault.setItem('null-onchange', 'value')).toBeResolved();
    });
  });

  // ===== CUSTOM EVENT DISPATCH =====

  describe('Custom Event Dispatch', () => {
    it('should allow manual event dispatching', () => {
      let eventReceived = false;
      let eventDetail = null;

      vault.addEventListener('custom-event', (event) => {
        eventReceived = true;
        eventDetail = event.detail;
      });

      const customEvent = new CustomEvent('custom-event', {
        detail: { custom: 'data' }
      });

      const result = vault.dispatchEvent(customEvent);

      expect(result).toBe(true);
      expect(eventReceived).toBe(true);
      expect(eventDetail).toEqual({ custom: 'data' });
    });

    it('should return false when dispatching prevented events', () => {
      vault.addEventListener('preventable-event', (event) => {
        event.preventDefault();
      });

      const event = new Event('preventable-event', { cancelable: true });
      const result = vault.dispatchEvent(event);

      expect(result).toBe(false);
    });

    it('should handle dispatching events with no listeners', () => {
      const event = new CustomEvent('no-listeners');

      expect(() => {
        const result = vault.dispatchEvent(event);
        expect(result).toBe(true);
      }).not.toThrow();
    });
  });

  // ===== EVENT DATA INTEGRITY =====

  describe('Event Data Integrity', () => {
    it('should include correct metadata in events', async () => {
      let eventData = null;

      vault.addEventListener('change', (event) => {
        eventData = event.detail;
      });

      const metadata = { ttl: 3600, priority: 'high', custom: { nested: 'data' } };
      await vault.setItem('meta-key', 'meta-value', metadata);

      expect(eventData.meta).toEqual(metadata);
      expect(eventData.op).toBe('set');
      expect(eventData.key).toBe('meta-key');
      expect(eventData.version).toEqual(jasmine.any(Number));
    });

    it('should handle null metadata correctly', async () => {
      const events = [];
      vault.addEventListener('change', (event) => {
        events.push(event.detail);
      });

      await vault.setItem('null-meta-key', 'null-meta-value', null);
      await vault.removeItem('null-meta-key');

      expect(events[0].meta).toBeNull();
      expect(events[1].meta).toBeNull();
    });

    it('should handle undefined metadata correctly', async () => {
      let eventData = null;

      vault.addEventListener('change', (event) => {
        eventData = event.detail;
      });

      await vault.setItem('undefined-meta-key', 'undefined-meta-value');

      expect(eventData.meta).toBeNull();
    });

    it('should generate version timestamps', async () => {
      const versions = [];

      vault.addEventListener('change', (event) => {
        versions.push(event.detail.version);
      });

      await vault.setItem('v1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 2));
      await vault.setItem('v2', 'value2');

      expect(versions).toHaveSize(2);
      expect(versions[1]).toBeGreaterThan(versions[0]);
    });
  });

  // ===== EVENT TIMING AND ORDERING =====

  describe('Event Timing and Ordering', () => {
    it('should maintain proper event order for sequential operations', async () => {
      const eventOrder = [];

      vault.addEventListener('change', (event) => {
        eventOrder.push(`${event.detail.op}-${event.detail.key || 'clear'}`);
      });

      await vault.setItem('key1', 'value1');
      await vault.setItem('key2', 'value2');
      await vault.removeItem('key1');
      await vault.clear();

      expect(eventOrder).toEqual([
        'set-key1',
        'set-key2',
        'remove-key1',
        'clear-clear'
      ]);
    });

    it('should handle concurrent operations correctly', async () => {
      const events = [];

      vault.addEventListener('change', (event) => {
        events.push({
          op: event.detail.op,
          key: event.detail.key
        });
      });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(vault.setItem(`concurrent-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      expect(events).toHaveSize(10);
      expect(events.every(e => e.op === 'set')).toBe(true);

      const keys = events.map(e => e.key).sort();
      const expectedKeys = Array.from({length: 10}, (_, i) => `concurrent-${i}`).sort();
      expect(keys).toEqual(expectedKeys);
    });
  });

  // ===== MIDDLEWARE INTEGRATION =====

  describe('Middleware Integration with Events', () => {
    it('should emit events after middleware processing', async () => {
      let eventData = null;
      let middlewareProcessed = false;

      vault.use({
        before: (context) => {
          if (context.operation === 'set') {
            context.meta = {
              ...context.meta,
              processed: true,
              timestamp: Date.now()
            };
          }
          return context;
        },
        after: (context, result) => {
          middlewareProcessed = true;
          return result;
        }
      });

      vault.addEventListener('change', (event) => {
        eventData = event.detail;
      });

      await vault.setItem('middleware-key', 'middleware-value', { original: 'meta' });

      expect(middlewareProcessed).toBe(true);
      expect(eventData.meta.original).toBe('meta');
      expect(eventData.meta.processed).toBe(true);
      expect(eventData.meta.timestamp).toEqual(jasmine.any(Number));
    });

    it('should NOT emit events when middleware prevents operations', async () => {
      let eventEmitted = false;

      vault.use({
        before: (context) => {
          if (context.key === 'blocked-key') {
            throw new Error('Operation blocked by middleware');
          }
          return context;
        }
      });

      vault.addEventListener('change', () => {
        eventEmitted = true;
      });

      // This should succeed and emit an event
      await vault.setItem('allowed-key', 'allowed-value');
      expect(eventEmitted).toBe(true);

      // Reset flag
      eventEmitted = false;

      // This should fail and not emit an event
      try {
        await vault.setItem('blocked-key', 'blocked-value');
      } catch (e) {
        // Expected to fail
      }

      expect(eventEmitted).toBe(false);
    });
  });
});
