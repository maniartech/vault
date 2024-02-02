import { get } from "http"
import Vault from "./vault"

type EncKeySalt = { key: string, salt: string }
type FuncEncKeySalt = (key: string) => Promise<EncKeySalt>
type EncConfig = EncKeySalt | FuncEncKeySalt | null

class SecuredVault extends Vault {
  #encConfig:EncConfig
  #keyCache:Map<string, CryptoKey> = new Map()

  constructor(dbName:string, encConfig:EncConfig) {
    super(dbName)
    this.#encConfig = encConfig
  }

  async setItem(key: string, value: any): Promise<void> {
    if (this.#encConfig === null) return super.setItem(key, value)

    const encKey = await this.#getKey(key)
    const encValue = await encrypt(encKey, typeof value === 'string' ? value : JSON.stringify(value))
    return super.setItem(key, encValue)
  }

  async getItem(key: string): Promise<any> {
    const encValue = await super.getItem(key)
    if (this.#encConfig === null) return encValue
    return decrypt(await this.#getKey(key), encValue)
  }

  #getKey = async (key: string): Promise<CryptoKey> => {
    if (this.#keyCache.has(key)) return this.#keyCache.get(key)!
    if (typeof this.#encConfig === 'function') {
      const encKeySalt = await this.#encConfig(key)
      return await generateKey(encKeySalt.key, await generateSalt(encKeySalt.salt))
    }

    const encKey = await generateKey( this.#encConfig!.key, await generateSalt(this.#encConfig!.salt))
    this.#keyCache.set(key, encKey)

    return encKey
  }
}

async function generateSalt(userInput:string): Promise<Uint8Array> {
  // Encode the user input as UTF-8
  const encoder = new TextEncoder();
  const encodedInput = encoder.encode(userInput);

  // Hash the encoded input to create a salt
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedInput);

  // Convert the buffer to a Uint8Array
  const salt = new Uint8Array(hashBuffer);

  return salt;
}

async function generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // First, encode the password as UTF-8
  const passwordBuffer = new TextEncoder().encode(password);

  // Import the password as a CryptoKey
  const importedKey = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
  );

  // Specify the algorithm for key derivation
  const keyDerivationAlgorithm = {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // A high number of iterations for security
      hash: "SHA-256"    // The hash function to use
  };

  // Specify the derived key algorithm
  const derivedKeyAlgorithm = {
      name: "AES-GCM",  // Algorithm for the derived key
      length: 256       // Length of the derived key
  };

  // Derive the key
  return await window.crypto.subtle.deriveKey(
      keyDerivationAlgorithm,
      importedKey,
      derivedKeyAlgorithm,
      false,            // Whether the derived key is extractable
      ["encrypt", "decrypt"] // The usage of the derived key
  );
}

async function generateSymmetricKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
      {
          name: "AES-GCM",
          length: 256, // Can be 128, 192, or 256
      },
      true, // Whether the key is extractable
      ["encrypt", "decrypt"] // Can "encrypt", "decrypt", "wrapKey", or "unwrapKey"
  );
}

// Function to encrypt data using AES-GCM
async function encrypt(key: CryptoKey, data:string): Promise<ArrayBuffer> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization vector
  const encodedData = new TextEncoder().encode(data);

  try {
      const encryptedData = await window.crypto.subtle.encrypt({
        name: "AES-GCM",
        iv: iv
      }, key,encodedData);
      return new Uint8Array([...iv, ...new Uint8Array(encryptedData)]).buffer;
  } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
  }
}

// Function to decrypt data using AES-GCM
async function decrypt(key: CryptoKey, encryptedData: ArrayBuffer): Promise<string> {
  const iv = encryptedData.slice(0, 12); // Extract the IV (first 12 bytes)
  const data = encryptedData.slice(12); // Extract the encrypted data

  try {
      const decryptedData = await window.crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: new Uint8Array(iv)
      }, key, data);
      return new TextDecoder().decode(decryptedData);
  } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
  }
}

export default SecuredVault