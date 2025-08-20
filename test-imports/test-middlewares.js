// Test 3: Middlewares import
import { validationMiddleware, expirationMiddleware, encryptionMiddleware } from '../middlewares/index.js';

console.log('✓ Middlewares import works');
console.log('validationMiddleware type:', typeof validationMiddleware);
console.log('expirationMiddleware type:', typeof expirationMiddleware);
console.log('encryptionMiddleware type:', typeof encryptionMiddleware);

// Test specific middleware import
import { encryptionMiddleware as specificEncryption } from '../middlewares/encryption.js';
console.log('✓ Specific middleware import works');
console.log('specificEncryption type:', typeof specificEncryption);