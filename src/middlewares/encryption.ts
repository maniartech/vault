/**
 * Encryption middleware for Vault Storage
 * Provides transparent encryption/decryption of vault data using Web Crypto API
 */

import { Middleware, MiddlewareContext } from '../types/middleware.js';
import { EncryptionConfig, EncryptionCredential } from '../types/crypto.js';

/**
 * Options for configuring encryption middleware
 */
export interface EncryptionOptions {
  /** Number of iterations for key derivation (default: 100000) */
  keyDerivationIterations?: number;
  /** Maximum number of keys to cache (default: 100) */
  maxCachedKeys?: number;
}

/**
 * Error thrown when encryption operations fail
 */
export class EncryptionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Creates an encryption middleware instance
 * @param config - Encryption configuration - credentials, provider function, or null for no encryption
 * @param options - Additional configuration options for encryption
 * @returns Middleware instance that handles encryption/decryption
 */
function encryptionMiddleware(
  config: EncryptionConfig,
  options: EncryptionOptions = {}
): Middleware {
  const keyCache = new Map<string, CryptoKey>();
  const {
    keyDerivationIterations = 100000,
    maxCachedKeys = 100
  } = options;

  /**
   * Gets or generates the encryption key for the specified vault key
   */
  async function getKey(key: string): Promise<CryptoKey> {
    if (keyCache.has(key)) {
      return keyCache.get(key)!;
    }

    let credential: EncryptionCredential;

    if (typeof config === 'function') {
      credential = await config(key);
    } else if (config !== null) {
      const c = config as EncryptionCredential;
      if (!c.password || !c.salt) {
        throw new EncryptionError('Invalid encryption credential');
      }
      credential = c;
    } else {
      throw new EncryptionError('No encryption configuration provided');
    }

    const cryptoKey = await generateKey(
      credential.password,
      await generateSalt(credential.salt),
      keyDerivationIterations
    );

    // Manage cache size
    if (keyCache.size >= maxCachedKeys) {
      const iter = keyCache.keys().next();
      const firstKey: string | undefined = iter.value;
      if (firstKey !== undefined) {
        keyCache.delete(firstKey);
      }
    }

    keyCache.set(key, cryptoKey);
    return cryptoKey;
  }

  return {
    name: 'encryption',

    async before(context: MiddlewareContext): Promise<MiddlewareContext> {
      // Only process set operations for encryption
      if (context.operation === 'set' && config !== null) {
        const { key, value } = context;

        if (key && value !== null && value !== undefined) {
          try {
            const encKey = await getKey(key);
            const dataToEncrypt = typeof value === 'string' ? value : JSON.stringify(value);
            const encryptedValue = await encrypt(encKey, dataToEncrypt);

            // Store as a special object that IndexedDB can handle reliably
            context.value = {
              __encrypted: true,
              data: Array.from(new Uint8Array(encryptedValue))
            };
          } catch (error) {
            throw new EncryptionError(
              `Failed to encrypt value for key "${key}"`,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }

      return context;
    },

    async after(context: MiddlewareContext, result: any): Promise<any> {
      // Only process get operations for decryption
      if (context.operation === 'get' && config !== null && result !== null) {
        const { key } = context;

        if (key) {
          try {
            // Check if this is encrypted data
            if (result && typeof result === 'object' && result.__encrypted && Array.isArray(result.data)) {
              const encKey = await getKey(key);
              const encryptedData = new Uint8Array(result.data).buffer;
              const decryptedValue = await decrypt(encKey, encryptedData);

              // Try to parse as JSON, fallback to string
              try {
                return JSON.parse(decryptedValue);
              } catch {
                return decryptedValue;
              }
            }

            // Not encrypted data, return as-is
            return result;
          } catch (error) {
            throw new EncryptionError(
              `Failed to decrypt value for key "${key}"`,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }

      return result;
    },

    async error(_context: MiddlewareContext, error: Error): Promise<Error> {
      // Pass through encryption errors, wrap others if they're crypto-related
      if (error instanceof EncryptionError) {
        return error;
      }

      // Check if this might be a crypto-related error
      if (error.message.includes('crypto') || error.message.includes('encrypt') || error.message.includes('decrypt')) {
        return new EncryptionError(`Encryption operation failed: ${error.message}`, error);
      }

      return error;
    }
  };
}

/**
 * Generates a salt from user input using SHA-256
 */
async function generateSalt(userInput: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const encodedInput = encoder.encode(userInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedInput);
  return new Uint8Array(hashBuffer);
}

/**
 * Generates a cryptographic key using PBKDF2
 */
async function generateKey(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const passwordBuffer = new TextEncoder().encode(password);

  const importedKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const keyDerivationAlgorithm = {
    name: "PBKDF2",
    salt: salt,
    iterations: iterations,
    hash: "SHA-256"
  };

  const derivedKeyAlgorithm = {
    name: "AES-GCM",
    length: 256
  };

  return await crypto.subtle.deriveKey(
    keyDerivationAlgorithm,
    importedKey,
    derivedKeyAlgorithm,
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts data using AES-GCM
 */
async function encrypt(key: CryptoKey, data: string): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);

  try {
    const encryptedData = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv: iv
    }, key, encodedData);

    // Combine IV and encrypted data
    return new Uint8Array([...iv, ...new Uint8Array(encryptedData)]).buffer;
  } catch (error) {
    throw new EncryptionError(
      'Encryption failed',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Decrypts data using AES-GCM
 */
async function decrypt(key: CryptoKey, encryptedData: ArrayBuffer): Promise<string> {
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  try {
    const decryptedData = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: new Uint8Array(iv)
    }, key, data);

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    throw new EncryptionError(
      'Decryption failed',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

export default encryptionMiddleware;

// Also export as named export for backward compatibility
export { encryptionMiddleware };