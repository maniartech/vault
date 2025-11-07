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

  // Value encoding/decoding for types that JSON can't handle
  type VT = { __vt: string; [key: string]: any };

  function isTypedArray(x: any): boolean {
    return ArrayBuffer.isView(x) && !(x instanceof DataView);
  }

  async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    // Try modern API first
    if (typeof (blob as any).arrayBuffer === 'function') {
      return await (blob as any).arrayBuffer();
    }
    // Fallback to FileReader
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  async function encodeValue(value: any, seen = new Set<any>()): Promise<any> {
    // Detect cycles
    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        throw new EncryptionError('Failed to encrypt value: circular structure detected');
      }
      seen.add(value);
    }

    // Primitives
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === 'string' || t === 'boolean') return value;
    if (t === 'number') {
      if (Number.isNaN(value)) return { __vt: 'number', v: 'NaN' };
      if (value === Infinity) return { __vt: 'number', v: 'Infinity' };
      if (value === -Infinity) return { __vt: 'number', v: '-Infinity' };
      return value;
    }
    if (t === 'bigint') return { __vt: 'bigint', v: value.toString() };
    if (t === 'symbol' || t === 'function') return undefined;

    // Special objects
    if (value instanceof Date) return { __vt: 'date', v: value.toISOString() };
    if (value instanceof RegExp) return { __vt: 'regexp', p: value.source, f: value.flags };
    if (value instanceof ArrayBuffer) return { __vt: 'arraybuffer', v: Array.from(new Uint8Array(value)) };
    if (isTypedArray(value)) {
      const u8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      return { __vt: 'typed', t: value.constructor.name, v: Array.from(u8) };
    }
    // Blob/File (needs async handling)
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      const ab = await blobToArrayBuffer(value);
      const tag: any = { __vt: 'blob', v: Array.from(new Uint8Array(ab)) };
      if (value.type) tag.type = value.type;
      if ((value as any).name) tag.name = (value as any).name;
      return tag;
    }
    if (value instanceof Map) {
      const entries: any[] = [];
      for (const [k, v] of value.entries()) {
        entries.push([await encodeValue(k, seen), await encodeValue(v, seen)]);
      }
      return { __vt: 'map', v: entries };
    }
    if (value instanceof Set) {
      const arr: any[] = [];
      for (const v of value.values()) {
        arr.push(await encodeValue(v, seen));
      }
      return { __vt: 'set', v: arr };
    }

    // Arrays
    if (Array.isArray(value)) {
      const result = [];
      for (let i = 0; i < value.length; i++) {
        result[i] = await encodeValue(value[i], seen);
      }
      return result;
    }

    // Plain objects
    if (Object.prototype.toString.call(value) === '[object Object]') {
      const result: any = {};
      for (const k in value) {
        if (value.hasOwnProperty(k)) {
          result[k] = await encodeValue(value[k], seen);
        }
      }
      return result;
    }

    // Fallback: try JSON (will drop functions, etc.)
    return value;
  }

  function decodeValue(val: any): any {
    if (val && typeof val === 'object' && val.__vt) {
      switch (val.__vt) {
        case 'number':
          if (val.v === 'NaN') return NaN;
          if (val.v === 'Infinity') return Infinity;
          if (val.v === '-Infinity') return -Infinity;
          return undefined;
        case 'bigint':
          return typeof BigInt !== 'undefined' ? BigInt(val.v) : val.v;
        case 'date':
          return new Date(val.v);
        case 'regexp':
          return new RegExp(val.p, val.f);
        case 'arraybuffer':
          return new Uint8Array(val.v).buffer;
        case 'typed': {
          const buf = new Uint8Array(val.v).buffer;
          switch (val.t) {
            case 'Uint8Array': return new Uint8Array(buf);
            case 'Int8Array': return new Int8Array(buf);
            case 'Uint16Array': return new Uint16Array(buf);
            case 'Int16Array': return new Int16Array(buf);
            case 'Uint32Array': return new Uint32Array(buf);
            case 'Int32Array': return new Int32Array(buf);
            case 'Float32Array': return new Float32Array(buf);
            case 'Float64Array': return new Float64Array(buf);
            default: return new Uint8Array(buf);
          }
        }
        case 'blob': {
          if (typeof Blob === 'undefined') return val; // Can't restore in non-browser
          const u8 = new Uint8Array(val.v);
          try {
            // Restore File if name is present
            if (val.name && typeof (globalThis as any).File === 'function') {
              return new (globalThis as any).File([u8], val.name, { type: val.type || '' });
            }
            return new Blob([u8], { type: val.type || '' });
          } catch {
            return new Blob([u8]);
          }
        }
        case 'map':
          return new Map(val.v.map((e: any[]) => [decodeValue(e[0]), decodeValue(e[1])]));
        case 'set':
          return new Set(val.v.map((e: any) => decodeValue(e)));
      }
    }

    if (Array.isArray(val)) {
      return val.map(item => decodeValue(item));
    }

    if (val && typeof val === 'object' && Object.prototype.toString.call(val) === '[object Object]') {
      const result: any = {};
      for (const k in val) {
        if (val.hasOwnProperty(k)) {
          result[k] = decodeValue(val[k]);
        }
      }
      return result;
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
            } else {
              // Encode rich types and serialize to JSON
              const encoded = await encodeValue(value);
              dataToEncrypt = JSON.stringify(encoded);
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
                return decodeValue(parsed);
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