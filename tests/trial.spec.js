import vault from "../dist/index.js"
import * as crypto from '../dist/crypto.js';

describe("A suite", () => {
  it("contains a spec with an expectation", async () => {
  const secretData = 'Hello, World!';
  const salt = await crypto.generateSalt("salt")
  const key = await crypto.generateKey("password", salt);
  const encryptedData = await crypto.encrypt(secretData, key);
  const decrypted = await crypto.decrypt(encryptedData, key);

  vault.encryptedData = encryptedData;

  console.log('Encrypted Data:', new Uint8Array(encryptedData));
  console.log('Decrypted Data:', decrypted);
  });
})


