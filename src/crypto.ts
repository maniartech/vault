// REF: https://chat.openai.com/c/e74873c9-6504-4e35-841b-098dc4101c16

// Utility function to generate a symmetric key for AES-GCM

export async function generateSalt(userInput:string): Promise<Uint8Array> {
  // Encode the user input as UTF-8
  const encoder = new TextEncoder();
  const encodedInput = encoder.encode(userInput);

  // Hash the encoded input to create a salt
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedInput);

  // Convert the buffer to a Uint8Array
  const salt = new Uint8Array(hashBuffer);

  return salt;
}

export async function generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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

export async function generateSymmetricKey(): Promise<CryptoKey> {
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
export async function encrypt(data:string, key: CryptoKey): Promise<ArrayBuffer> {
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
export async function decrypt(encryptedData: ArrayBuffer, key: CryptoKey): Promise<string> {
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

// // Example usage
// (async () => {
//   const secretData = 'Hello, World!';
//   const { encryptedData, key } = await encryptData(secretData);
//   const decrypted = await decryptData(encryptedData, key);

//   console.log('Encrypted Data:', new Uint8Array(encryptedData));
//   console.log('Decrypted Data:', decrypted);
// })();
