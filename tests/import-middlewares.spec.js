// Import test for middlewares using karma/jasmine
import { validationMiddleware, expirationMiddleware, encryptionMiddleware } from '../dist/middlewares/index.js';
import encryptionMiddlewareDefault from '../dist/middlewares/encryption.js';

describe('Import Tests - Middlewares', () => {
  it('should import all middlewares from index', () => {
    expect(validationMiddleware).toBeDefined();
    expect(typeof validationMiddleware).toBe('function');

    expect(expirationMiddleware).toBeDefined();
    expect(typeof expirationMiddleware).toBe('function');

    expect(encryptionMiddleware).toBeDefined();
    expect(typeof encryptionMiddleware).toBe('function');
  });

  it('should import specific middleware as default', () => {
    expect(encryptionMiddlewareDefault).toBeDefined();
    expect(typeof encryptionMiddlewareDefault).toBe('function');
    expect(encryptionMiddlewareDefault).toBe(encryptionMiddleware);
  });
});