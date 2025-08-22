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
  // Coalesce concurrent key derivation per vault key to a single in-flight Promise
  const keyPromises = new Map<string, Promise<CryptoKey | null>>();
  const {
    keyDerivationIterations = 100000,
    maxCachedKeys = 100
  } = options;

  /**
   * Gets or generates the encryption key for the specified vault key
   */
  async function getKey(key: string): Promise<CryptoKey | null> {
    // If caching is enabled and we already have a key, return it
    if (maxCachedKeys > 0 && keyCache.has(key)) {
      return keyCache.get(key)!;
    }

    // Coalesce concurrent requests for the same key
    if (keyPromises.has(key)) {
      return keyPromises.get(key)!;
    }

    const promise = (async () => {
      let credential: EncryptionCredential | null;

      if (typeof config === 'function') {
        const provided = await config(key);
        // A null/undefined credential means "skip encryption for this key"
        if (provided == null) return null;
        // Validate shape
        if (typeof (provided as any).password !== 'string' || typeof (provided as any).salt !== 'string') {
          throw new EncryptionError('Invalid encryption credential');
        }
        credential = provided as EncryptionCredential;
      } else if (config !== null) {
        const c = config as EncryptionCredential;
        if (!c || typeof c.password !== 'string' || typeof c.salt !== 'string' || !c.password || !c.salt) {
          throw new EncryptionError('Invalid encryption credential');
        }
        credential = c;
      } else {
        // Global config is null: encryption is disabled
        return null;
      }

      const cryptoKey = await generateKey(
        credential.password,
        await generateSalt(credential.salt),
        keyDerivationIterations
      );

      // Manage cache size (only when caching is enabled)
      if (maxCachedKeys > 0) {
        if (keyCache.size >= maxCachedKeys) {
          const iter = keyCache.keys().next();
          const firstKey: string | undefined = iter.value;
          if (firstKey !== undefined) {
            keyCache.delete(firstKey);
          }
        }

        keyCache.set(key, cryptoKey);
      }

      return cryptoKey;
    })();

    keyPromises.set(key, promise);
    try {
      return await promise;
    } finally {
      keyPromises.delete(key);
    }
  }

  // Internal type tag for values that JSON cannot represent faithfully
  type EncodedSpecial = { __vt: 'number'; v: 'NaN' | 'Infinity' | '-Infinity' };
  function encodeSpecialNumber(n: number): EncodedSpecial {
    if (Number.isNaN(n)) return { __vt: 'number', v: 'NaN' };
    return n === Infinity ? { __vt: 'number', v: 'Infinity' } : { __vt: 'number', v: '-Infinity' };
  }
  function decodeMaybeSpecial(val: any): any {
    if (val && typeof val === 'object' && val.__vt === 'number') {
      switch (val.v) {
        case 'NaN': return NaN;
        case 'Infinity': return Infinity;
        case '-Infinity': return -Infinity;
      }
    }
    return val;
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
            // If provider indicates to skip encryption for this key, pass-through
            if (!encKey) return context;

            let dataToEncrypt: string;
            if (typeof value === 'string') {
              // Store raw string; we'll detect as non-JSON on decrypt and return as-is
              dataToEncrypt = value;
            } else if (typeof value === 'number' && !Number.isFinite(value)) {
              // Wrap special numbers so they can be faithfully restored
              dataToEncrypt = JSON.stringify(encodeSpecialNumber(value));
            } else {
              dataToEncrypt = JSON.stringify(value);
            }

            const encryptedValue = await encrypt(encKey, dataToEncrypt);

            // Store as a special object that IndexedDB can handle reliably
            context.value = {
              __encrypted: true,
              data: Array.from(new Uint8Array(encryptedValue))
            };
          } catch (error) {
            throw new EncryptionError(
              `Failed to encrypt value for key "${key}": ${(error as any)?.message ?? ''}`.trim(),
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
              if (!encKey) {
                // Config for this key says no encryption; return raw as-is
                return result;
              }
              const encryptedData = new Uint8Array(result.data).buffer;
              const decryptedValue = await decrypt(encKey, encryptedData);

              // Try to parse as JSON, fallback to string
              try {
                const parsed = JSON.parse(decryptedValue);
                return decodeMaybeSpecial(parsed);
              } catch {
                return decryptedValue;
              }
            }

            // Not encrypted data, return as-is
            return result;
          } catch (error) {
            throw new EncryptionError(
              `Failed to decrypt value for key "${key}": ${(error as any)?.message ?? ''}`.trim(),
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