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
    // TODO: Fix jasmineToString error when comparing vault proxy instances
    xit('should register middleware using use() method', () => {
      const testMiddleware = {
        name: 'test-middleware',
        before: jasmine.createSpy('before').and.returnValue(Promise.resolve())
      };

      const result = vault.use(testMiddleware);
      expect(result === vault).toBe(true); // Should return vault instance for chaining
      expect(vault.middlewares).toContain(testMiddleware);
    });

    // TODO: Fix jasmineToString error when comparing vault proxy instances
    xit('should allow method chaining when registering multiple middlewares', () => {
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

    // TODO: Fix error hook execution order test
    xit('should execute error hooks in registration order', async () => {
      const executionOrder = [];

      const middleware1 = {
        name: 'middleware1',
        before: async (context) => {
          throw new Error('Test error');
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

      expect(capturedContext.operation).toBe('set');
      expect(capturedContext.key).toBe('test-key');
      expect(capturedContext.value).toBe('test-value');
      expect(capturedResult).toBeUndefined(); // setItem returns void
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
    // TODO: Fix error handling in before hooks
    xit('should catch errors in before hooks and run error handlers', async () => {
      let errorHandled = false;
      const testError = new Error('Before hook error');

      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          throw testError;
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

    // TODO: Fix core operation error handling
    xit('should catch errors in core operations and run error handlers', async () => {
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

    // TODO: Fix error transformation handling
    xit('should allow error handlers to transform errors', async () => {
      const originalError = new Error('Original error');
      const transformedError = new Error('Transformed error');

      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          throw originalError;
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

    // TODO: Fix error suppression handling
    xit('should allow error handlers to suppress errors by returning undefined', async () => {
      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          throw new Error('This error should be suppressed');
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

    // TODO: Fix after hook error handling
    xit('should handle errors in after hooks', async () => {
      let errorHandled = false;
      const afterError = new Error('After hook error');

      const errorMiddleware = {
        name: 'after-error-thrower',
        after: async (context, result) => {
          throw afterError;
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

    // TODO: Fix error hook error handling
    xit('should handle errors in error hooks themselves', async () => {
      const originalError = new Error('Original error');
      const errorHookError = new Error('Error hook error');

      const errorMiddleware = {
        name: 'error-thrower',
        before: async (context) => {
          throw originalError;
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
      expect(executionLog).toEqual(['before', 'error']);
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
});