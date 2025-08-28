/**
 * Comprehensive tests for the middleware system
 */

import Vault from '../dist/vault.js';

describe('Middleware System', () => {
  let vault;

  beforeEach(() => {
    vault = new Vault('test-middleware-system');
  });

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  describe('Middleware Registration', () => {
    it('should register middleware using use() method', () => {
      const testMiddleware = {
        name: 'test-middleware',
        before: jasmine.createSpy('before').and.returnValue(Promise.resolve())
      };

      const result = vault.use(testMiddleware);
      expect(result === vault).toBe(true); // Should return vault instance for chaining
      expect(vault.middlewares).toContain(testMiddleware);
    });

  it('should allow method chaining when registering multiple middlewares', () => {
      const middleware1 = { name: 'middleware1' };
      const middleware2 = { name: 'middleware2' };
      const middleware3 = { name: 'middleware3' };

      const result = vault
        .use(middleware1)
        .use(middleware2)
        .use(middleware3);

      expect(result === vault).toBe(true);
      expect(vault.middlewares).toEqual([middleware1, middleware2, middleware3]);
    });

    it('should maintain middleware registration order', () => {
      const middleware1 = { name: 'first' };
      const middleware2 = { name: 'second' };
      const middleware3 = { name: 'third' };

      vault.use(middleware1);
      vault.use(middleware2);
      vault.use(middleware3);

      expect(vault.middlewares[0]).toBe(middleware1);
      expect(vault.middlewares[1]).toBe(middleware2);
      expect(vault.middlewares[2]).toBe(middleware3);
    });
  });

  describe('Middleware Execution Order', () => {
    it('should execute before hooks in registration order', async () => {
      const executionOrder = [];

      const middleware1 = {
        name: 'middleware1',
        before: async (context) => {
          executionOrder.push('before1');
          return context;
        }
      };

      const middleware2 = {
        name: 'middleware2',
        before: async (context) => {
          executionOrder.push('before2');
          return context;
        }
      };

      const middleware3 = {
        name: 'middleware3',
        before: async (context) => {
          executionOrder.push('before3');
          return context;
        }
      };

      vault.use(middleware1).use(middleware2).use(middleware3);

      await vault.setItem('test', 'value');

      expect(executionOrder).toEqual(['before1', 'before2', 'before3']);
    });

    it('should execute after hooks in registration order', async () => {
      const executionOrder = [];

      const middleware1 = {
        name: 'middleware1',
        after: async (context, result) => {
          executionOrder.push('after1');
          return result;
        }
      };

      const middleware2 = {
        name: 'middleware2',
        after: async (context, result) => {
          executionOrder.push('after2');
          return result;
        }
      };

      vault.use(middleware1).use(middleware2);

      await vault.setItem('test', 'value');

      expect(executionOrder).toEqual(['after1', 'after2']);
    });

    it('should execute error hooks in registration order', async () => {
      const executionOrder = [];

      const middleware1 = {
        name: 'middleware1',
        before: async (context) => {
          if (context.operation === 'set') {
            throw new Error('Test error');
          }
          return context;
        },
        error: async (context, error) => {
          executionOrder.push('error1');
          return error;
        }
      };

      const middleware2 = {
        name: 'middleware2',
        error: async (context, error) => {
          executionOrder.push('error2');
          return error;
        }
      };

      vault.use(middleware1).use(middleware2);

      try {
        await vault.setItem('test', 'value');
      } catch (error) {
        // Expected to throw
      }

      expect(executionOrder).toEqual(['error1', 'error2']);
    });
  });

  describe('Context Passing and Modification', () => {
    it('should pass correct context to before hooks', async () => {
      let capturedContext;

      const middleware = {
        name: 'context-capturer',
        before: async (context) => {
          capturedContext = { ...context };
          return context;
        }
      };

      vault.use(middleware);

      await vault.setItem('test-key', 'test-value', { meta: 'data' });

      expect(capturedContext.operation).toBe('set');
      expect(capturedContext.key).toBe('test-key');
      expect(capturedContext.value).toBe('test-value');
      expect(capturedContext.meta).toEqual({ meta: 'data' });
      expect(capturedContext.vaultInstance).toBeDefined();
      expect(capturedContext.vaultInstance.storageName).toBe('test-middleware-system');
    });

    it('should allow middleware to modify context', async () => {
      let finalContext;

      const modifyingMiddleware = {
        name: 'modifier',
        before: async (context) => {
          context.key = 'modified-key';
          context.value = 'modified-value';
          context.meta = { modified: true };
          return context;
        }
      };

      const capturingMiddleware = {
        name: 'capturer',
        before: async (context) => {
          finalContext = { ...context };
          return context;
        }
      };

      vault.use(modifyingMiddleware).use(capturingMiddleware);

      await vault.setItem('original-key', 'original-value', { original: true });

      expect(finalContext.key).toBe('modified-key');
      expect(finalContext.value).toBe('modified-value');
      expect(finalContext.meta).toEqual({ modified: true });

      // Verify that the modified values were actually used
      const retrieved = await vault.getItem('modified-key');
      expect(retrieved).toBe('modified-value');

      const meta = await vault.getItemMeta('modified-key');
      expect(meta).toEqual({ modified: true });
    });

    it('should pass correct context to after hooks', async () => {
      let capturedContext;
      let capturedResult;

      const middleware = {
        name: 'after-capturer',
        after: async (context, result) => {
          capturedContext = { ...context };
          capturedResult = result;
          return result;
        }
      };

      vault.use(middleware);

      await vault.setItem('test-key', 'test-value');
      const retrieved = await vault.getItem('test-key');

      expect(capturedContext.operation).toBe('get');
      expect(capturedContext.key).toBe('test-key');
      expect(capturedContext.value).toBe('test-value');
      expect(capturedResult).toBe('test-value');
    });

    it('should allow middleware to modify results in after hooks', async () => {
      const middleware = {
        name: 'result-modifier',
        after: async (context, result) => {
          if (context.operation === 'get') {
            return `modified-${result}`;
          }
          return result;
        }
      };

      vault.use(middleware);

      await vault.setItem('test', 'original');
      const result = await vault.getItem('test');

      expect(result).toBe('modified-original');
    });

    it('should chain result modifications through multiple after hooks', async () => {
      const middleware1 = {
        name: 'modifier1',
        after: async (context, result) => {
          if (context.operation === 'get') {
            return `first-${result}`;
          }
          return result;
        }
      };

      const middleware2 = {
        name: 'modifier2',
        after: async (context, result) => {
          if (context.operation === 'get') {
            return `second-${result}`;
          }
          return result;
        }
      };

      vault.use(middleware1).use(middleware2);

      await vault.setItem('test', 'original');
      const result = await vault.getItem('test');

      expect(result).toBe('second-first-original');
    });
  });

  describe('Error Handling', () => {
    it('should catch errors in before hooks and run error handlers', async () => {
      let errorHandled = false;
      const testError = new Error('Before hook error');

      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          if (context.operation === 'set') {
            throw testError;
          }
          return context;
        }
      };

      const errorHandler = {
        name: 'error-handler',
        error: async (context, error) => {
          errorHandled = true;
          expect(error).toBe(testError);
          return error; // Re-throw
        }
      };

      vault.use(errorMiddleware).use(errorHandler);

      await expectAsync(vault.setItem('test', 'value'))
        .toBeRejectedWith(testError);

      expect(errorHandled).toBe(true);
    });

    it('should catch errors in core operations and run error handlers', async () => {
      let errorHandled = false;

      const errorHandler = {
        name: 'error-handler',
        error: async (context, error) => {
          errorHandled = true;
          expect(error.message).toContain('Key must be a non-empty string');
          return error;
        }
      };

      vault.use(errorHandler);

      await expectAsync(vault.setItem('', 'value'))
        .toBeRejectedWithError('Key must be a non-empty string');

      expect(errorHandled).toBe(true);
    });

    it('should allow error handlers to transform errors', async () => {
      const originalError = new Error('Original error');
      const transformedError = new Error('Transformed error');

      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          // Only throw for the intended operation to avoid interfering with afterEach cleanup
          if (context.operation === 'set') {
            throw originalError;
          }
          return context;
        }
      };

      const errorTransformer = {
        name: 'error-transformer',
        error: async (context, error) => {
          expect(error).toBe(originalError);
          return transformedError;
        }
      };

      vault.use(errorMiddleware).use(errorTransformer);

      await expectAsync(vault.setItem('test', 'value'))
        .toBeRejectedWith(transformedError);
    });

    it('should allow error handlers to suppress errors by returning undefined', async () => {
      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          // Only throw for the intended operation to avoid interfering with afterEach cleanup
          if (context.operation === 'set') {
            throw new Error('This error should be suppressed');
          }
          return context;
        }
      };

      const errorSuppressor = {
        name: 'error-suppressor',
        error: async (context, error) => {
          return undefined; // Suppress the error
        }
      };

      vault.use(errorMiddleware).use(errorSuppressor);

      const result = await vault.setItem('test', 'value');
      expect(result).toBeNull(); // Should return null when error is suppressed
    });

    it('should handle errors in after hooks', async () => {
      let errorHandled = false;
      const afterError = new Error('After hook error');

      const errorMiddleware = {
        name: 'after-error-thrower',
        after: async (context, result) => {
          // Only throw for the intended operation to avoid interfering with afterEach cleanup
          if (context.operation === 'set') {
            throw afterError;
          }
          return result;
        }
      };

      const errorHandler = {
        name: 'error-handler',
        error: async (context, error) => {
          errorHandled = true;
          expect(error).toBe(afterError);
          return error;
        }
      };

      vault.use(errorMiddleware).use(errorHandler);

      await expectAsync(vault.setItem('test', 'value'))
        .toBeRejectedWith(afterError);

      expect(errorHandled).toBe(true);
    });

    it('should handle errors in error hooks themselves', async () => {
      const originalError = new Error('Original error');
      const errorHookError = new Error('Error hook error');

      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          // Only throw for the intended operation to avoid interfering with afterEach cleanup
          if (context.operation === 'set') {
            throw originalError;
          }
          return context;
        }
      };

      const faultyErrorHandler = {
        name: 'faulty-error-handler',
        error: async (context, error) => {
          throw errorHookError; // This should be caught and replace the original error
        }
      };

      vault.use(errorMiddleware).use(faultyErrorHandler);

      await expectAsync(vault.setItem('test', 'value'))
        .toBeRejectedWith(errorHookError); // The error hook error should be thrown
    });
  });

  describe('Middleware Execution for All Operations', () => {
    let executionLog;
    let testMiddleware;

    beforeEach(() => {
      executionLog = [];
      testMiddleware = {
        name: 'test-middleware',
        before: async (context) => {
          executionLog.push(`before-${context.operation}`);
          return context;
        },
        after: async (context, result) => {
          executionLog.push(`after-${context.operation}`);
          return result;
        }
      };
      vault.use(testMiddleware);
    });

    it('should execute middleware for setItem operations', async () => {
      await vault.setItem('test', 'value');
      expect(executionLog).toEqual(['before-set', 'after-set']);
    });

    it('should execute middleware for getItem operations', async () => {
      await vault.setItem('test', 'value');
      executionLog = []; // Reset log

      await vault.getItem('test');
      expect(executionLog).toEqual(['before-get', 'after-get']);
    });

    it('should execute middleware for removeItem operations', async () => {
      await vault.setItem('test', 'value');
      executionLog = []; // Reset log

      await vault.removeItem('test');
      expect(executionLog).toEqual(['before-remove', 'after-remove']);
    });

    it('should execute middleware for clear operations', async () => {
      await vault.setItem('test', 'value');
      executionLog = []; // Reset log

      await vault.clear();
      expect(executionLog).toEqual(['before-clear', 'after-clear']);
    });

    it('should execute middleware for keys operations', async () => {
      await vault.setItem('test', 'value');
      executionLog = []; // Reset log

      await vault.keys();
      expect(executionLog).toEqual(['before-keys', 'after-keys']);
    });

    it('should execute middleware for length operations', async () => {
      await vault.setItem('test', 'value');
      executionLog = []; // Reset log

      await vault.length();
      expect(executionLog).toEqual(['before-length', 'after-length']);
    });

    it('should execute middleware for getItemMeta operations', async () => {
      await vault.setItem('test', 'value', { meta: 'data' });
      executionLog = []; // Reset log

      await vault.getItemMeta('test');
      expect(executionLog).toEqual(['before-getItemMeta', 'after-getItemMeta']);
    });
  });

  describe('Middleware Hook Combinations', () => {
    it('should work with middleware that only has before hooks', async () => {
      const beforeOnlyMiddleware = {
        name: 'before-only',
        before: async (context) => {
          context.value = `modified-${context.value}`;
          return context;
        }
      };

      vault.use(beforeOnlyMiddleware);

      await vault.setItem('test', 'value');
      const result = await vault.getItem('test');
      expect(result).toBe('modified-value');
    });

    it('should work with middleware that only has after hooks', async () => {
      const afterOnlyMiddleware = {
        name: 'after-only',
        after: async (context, result) => {
          if (context.operation === 'get') {
            return `modified-${result}`;
          }
          return result;
        }
      };

      vault.use(afterOnlyMiddleware);

      await vault.setItem('test', 'value');
      const result = await vault.getItem('test');
      expect(result).toBe('modified-value');
    });

    it('should work with middleware that only has error hooks', async () => {
      let errorCaught = false;

      const errorOnlyMiddleware = {
        name: 'error-only',
        error: async (context, error) => {
          errorCaught = true;
          return error;
        }
      };

      vault.use(errorOnlyMiddleware);

      await expectAsync(vault.setItem('', 'value'))
        .toBeRejected();

      expect(errorCaught).toBe(true);
    });

    it('should work with middleware that has all three hooks', async () => {
      const executionLog = [];

      const fullMiddleware = {
        name: 'full-middleware',
        before: async (context) => {
          executionLog.push('before');
          return context;
        },
        after: async (context, result) => {
          executionLog.push('after');
          return result;
        },
        error: async (context, error) => {
          executionLog.push('error');
          return error;
        }
      };

      vault.use(fullMiddleware);

      // Test successful operation
      await vault.setItem('test', 'value');
      expect(executionLog).toEqual(['before', 'after']);

      // Test error operation
      executionLog.length = 0;
      await expectAsync(vault.setItem('', 'value')).toBeRejected();
      expect(executionLog).toEqual(['error']);
    });
  });

  describe('Middleware Performance and Edge Cases', () => {
    it('should handle many middleware efficiently', async () => {
      const startTime = performance.now();

      // Register 100 simple middlewares
      for (let i = 0; i < 100; i++) {
        vault.use({
          name: `middleware-${i}`,
          before: async (context) => context,
          after: async (context, result) => result
        });
      }

      await vault.setItem('test', 'value');
      await vault.getItem('test');

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle middleware with async operations', async () => {
      const asyncMiddleware = {
        name: 'async-middleware',
        before: async (context) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          context.value = `async-${context.value}`;
          return context;
        },
        after: async (context, result) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (context.operation === 'get') {
            return `async-${result}`;
          }
          return result;
        }
      };

      vault.use(asyncMiddleware);

      await vault.setItem('test', 'value');
      const result = await vault.getItem('test');
      expect(result).toBe('async-async-value');
    });

    it('should handle middleware that returns synchronous values', async () => {
      const syncMiddleware = {
        name: 'sync-middleware',
        before: (context) => {
          context.value = `sync-${context.value}`;
          return context;
        },
        after: (context, result) => {
          if (context.operation === 'get') {
            return `sync-${result}`;
          }
          return result;
        }
      };

      vault.use(syncMiddleware);

      await vault.setItem('test', 'value');
      const result = await vault.getItem('test');
      expect(result).toBe('sync-sync-value');
    });

    it('should handle empty middleware arrays', async () => {
      // Vault starts with no middleware
      expect(vault.middlewares).toEqual([]);

      // Should work normally without any middleware
      await vault.setItem('test', 'value');
      const result = await vault.getItem('test');
      expect(result).toBe('value');
    });

    it('should preserve middleware isolation between vault instances', async () => {
      const vault1 = new Vault('vault1');
      const vault2 = new Vault('vault2');

      const middleware1 = { name: 'middleware1' };
      const middleware2 = { name: 'middleware2' };

      vault1.use(middleware1);
      vault2.use(middleware2);

      expect(vault1.middlewares).toEqual([middleware1]);
      expect(vault2.middlewares).toEqual([middleware2]);
      expect(vault1.middlewares).not.toEqual(vault2.middlewares);

      await vault1.clear();
      await vault2.clear();
    });
  });

  describe('Enhanced Context Support', () => {
    describe('setItem Previous Values', () => {
      it('should provide previous values to middleware during setItem when record exists', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          before: async (context) => {
            capturedContext = { ...context };
            return context;
          }
        };

        vault.use(contextCapturer);

        // First, set an initial value
        await vault.setItem('test-key', 'initial-value', { version: 1 });

        // Then update it and capture the context
        await vault.setItem('test-key', 'updated-value', { version: 2 });

        expect(capturedContext.operation).toBe('set');
        expect(capturedContext.key).toBe('test-key');
        expect(capturedContext.value).toBe('updated-value');
        expect(capturedContext.meta).toEqual({ version: 2 });
        expect(capturedContext.previousValue).toBe('initial-value');
        expect(capturedContext.previousMeta).toEqual({ version: 1 });
      });

      it('should provide null previous values to middleware during setItem when record does not exist', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          before: async (context) => {
            capturedContext = { ...context };
            return context;
          }
        };

        vault.use(contextCapturer);

        // Set a new value (no previous record)
        await vault.setItem('new-key', 'new-value', { version: 1 });

        expect(capturedContext.operation).toBe('set');
        expect(capturedContext.key).toBe('new-key');
        expect(capturedContext.value).toBe('new-value');
        expect(capturedContext.meta).toEqual({ version: 1 });
        expect(capturedContext.previousValue).toBeNull();
        expect(capturedContext.previousMeta).toBeNull();
      });

      it('should enable change detection middleware using previous values', async () => {
        const changeLog = [];

        const changeDetectionMiddleware = {
          name: 'change-detector',
          before: async (context) => {
            if (context.operation === 'set') {
              const hasValueChanged = context.value !== context.previousValue;
              const hasMetaChanged = JSON.stringify(context.meta) !== JSON.stringify(context.previousMeta);

              changeLog.push({
                key: context.key,
                hasValueChanged,
                hasMetaChanged,
                from: { value: context.previousValue, meta: context.previousMeta },
                to: { value: context.value, meta: context.meta }
              });
            }
            return context;
          }
        };

        vault.use(changeDetectionMiddleware);

        // Initial set
        await vault.setItem('test', 'value1', { count: 1 });
        expect(changeLog[0].hasValueChanged).toBe(true); // null -> 'value1'
        expect(changeLog[0].hasMetaChanged).toBe(true); // null -> {count: 1}

        // Value change only
        await vault.setItem('test', 'value2', { count: 1 });
        expect(changeLog[1].hasValueChanged).toBe(true); // 'value1' -> 'value2'
        expect(changeLog[1].hasMetaChanged).toBe(false); // {count: 1} -> {count: 1}

        // Meta change only
        await vault.setItem('test', 'value2', { count: 2 });
        expect(changeLog[2].hasValueChanged).toBe(false); // 'value2' -> 'value2'
        expect(changeLog[2].hasMetaChanged).toBe(true); // {count: 1} -> {count: 2}

        // No change
        await vault.setItem('test', 'value2', { count: 2 });
        expect(changeLog[3].hasValueChanged).toBe(false);
        expect(changeLog[3].hasMetaChanged).toBe(false);
      });

      it('should enable audit middleware using previous values', async () => {
        const auditLog = [];

        const auditMiddleware = {
          name: 'auditor',
          after: async (context, result) => {
            if (context.operation === 'set') {
              auditLog.push({
                timestamp: Date.now(),
                key: context.key,
                previous: { value: context.previousValue, meta: context.previousMeta },
                current: { value: context.value, meta: context.meta }
              });
            }
            return result;
          }
        };

        vault.use(auditMiddleware);

        await vault.setItem('audit-test', 'first', { id: 1 });
        await vault.setItem('audit-test', 'second', { id: 2 });

        expect(auditLog.length).toBe(2);

        expect(auditLog[0].key).toBe('audit-test');
        expect(auditLog[0].previous.value).toBeNull();
        expect(auditLog[0].previous.meta).toBeNull();
        expect(auditLog[0].current.value).toBe('first');
        expect(auditLog[0].current.meta).toEqual({ id: 1 });

        expect(auditLog[1].key).toBe('audit-test');
        expect(auditLog[1].previous.value).toBe('first');
        expect(auditLog[1].previous.meta).toEqual({ id: 1 });
        expect(auditLog[1].current.value).toBe('second');
        expect(auditLog[1].current.meta).toEqual({ id: 2 });
      });
    });

    describe('Context Value and Meta Storage', () => {
      it('should populate context.value and context.meta during getItem', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          after: async (context, result) => {
            capturedContext = { ...context };
            return result;
          }
        };

        vault.use(contextCapturer);

        await vault.setItem('test-get', 'stored-value', { type: 'test' });
        const result = await vault.getItem('test-get');

        expect(result).toBe('stored-value');
        expect(capturedContext.operation).toBe('get');
        expect(capturedContext.key).toBe('test-get');
        expect(capturedContext.value).toBe('stored-value');
        expect(capturedContext.meta).toEqual({ type: 'test' });
      });

      it('should populate context.value and context.meta during removeItem', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          after: async (context, result) => {
            capturedContext = { ...context };
            return result;
          }
        };

        vault.use(contextCapturer);

        await vault.setItem('test-remove', 'to-be-removed', { status: 'active' });
        await vault.removeItem('test-remove');

        expect(capturedContext.operation).toBe('remove');
        expect(capturedContext.key).toBe('test-remove');
        expect(capturedContext.value).toBe('to-be-removed');
        expect(capturedContext.meta).toEqual({ status: 'active' });
      });

      it('should populate context.value and context.meta during getItemMeta', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          after: async (context, result) => {
            capturedContext = { ...context };
            return result;
          }
        };

        vault.use(contextCapturer);

        await vault.setItem('test-meta', 'meta-value', { category: 'metadata' });
        const meta = await vault.getItemMeta('test-meta');

        expect(meta).toEqual({ category: 'metadata' });
        expect(capturedContext.operation).toBe('getItemMeta');
        expect(capturedContext.key).toBe('test-meta');
        expect(capturedContext.value).toBe('meta-value');
        expect(capturedContext.meta).toEqual({ category: 'metadata' });
      });

      it('should handle null values and metadata correctly in context', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          after: async (context, result) => {
            capturedContext = { ...context };
            return result;
          }
        };

        vault.use(contextCapturer);

        // Test with null metadata
        await vault.setItem('null-meta-test', 'value-with-null-meta', null);
        await vault.getItem('null-meta-test');

        expect(capturedContext.value).toBe('value-with-null-meta');
        expect(capturedContext.meta).toBeNull();

        // Test with undefined value
        await vault.setItem('undefined-test', undefined, { type: 'undefined' });
        await vault.getItem('undefined-test');

        expect(capturedContext.value).toBeUndefined();
        expect(capturedContext.meta).toEqual({ type: 'undefined' });
      });

      it('should handle non-existent keys correctly in context', async () => {
        let capturedContext;

        const contextCapturer = {
          name: 'context-capturer',
          after: async (context, result) => {
            capturedContext = { ...context };
            return result;
          }
        };

        vault.use(contextCapturer);

        const result = await vault.getItem('non-existent-key');

        expect(result).toBeNull();
        expect(capturedContext.operation).toBe('get');
        expect(capturedContext.key).toBe('non-existent-key');
        expect(capturedContext.value).toBeNull();
        expect(capturedContext.meta).toBeNull();
      });
    });

    describe('Context Race Condition Safety', () => {
      it('should maintain context isolation between concurrent operations', async () => {
        const contextLog = [];

        const concurrencyTester = {
          name: 'concurrency-tester',
          before: async (context) => {
            // Add delay to simulate processing time
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            contextLog.push({
              operation: context.operation,
              key: context.key,
              timestamp: Date.now()
            });
            return context;
          }
        };

        vault.use(concurrencyTester);

        // Run multiple operations concurrently
        const promises = [
          vault.setItem('key1', 'value1'),
          vault.setItem('key2', 'value2'),
          vault.setItem('key3', 'value3'),
          vault.getItem('key1'),
          vault.getItem('key2')
        ];

        await Promise.all(promises);

        // Verify all operations were logged correctly
        expect(contextLog.length).toBe(5);

        // Check that each context had the correct key
        const key1Contexts = contextLog.filter(log => log.key === 'key1');
        const key2Contexts = contextLog.filter(log => log.key === 'key2');
        const key3Contexts = contextLog.filter(log => log.key === 'key3');

        expect(key1Contexts.length).toBe(2); // 1 set + 1 get
        expect(key2Contexts.length).toBe(2); // 1 set + 1 get
        expect(key3Contexts.length).toBe(1); // 1 set only
      });
    });
  });
});