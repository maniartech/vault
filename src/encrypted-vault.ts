/**
 * EncryptedVault - A preconfigured Vault with encryption middleware
 * Provides transparent encryption/decryption of all stored data
 */

import Vault from './vault.js';
import proxy from './proxy-handler.js';
import encryptionMiddleware, { EncryptionOptions } from './middlewares/encryption.js';
import { EncryptionConfig } from './types/crypto.js';

/**
 * Options for configuring EncryptedVault
 */
export interface EncryptedVaultOptions extends EncryptionOptions {
  /** Name of the storage database */
  storageName?: string;
}

/**
 * EncryptedVault - A Vault preconfigured with encryption middleware
 *
 * This class extends the base Vault functionality by automatically applying
 * encryption middleware to all operations, providing transparent encryption
 * and decryption of stored data.
 *
 * @example
 * ```typescript
 * // Create an encrypted vault with password-based encryption
 * const vault = new EncryptedVault({
 *   password: 'my-secret-password',
 *   salt: 'my-unique-salt'
 * });
 *
 * // Store data (automatically encrypted)
 * await vault.setItem('user', { name: 'John', email: 'john@example.com' });
 *
 * // Retrieve data (automatically decrypted)
 * const user = await vault.getItem('user');
 * console.log(user.name); // 'John'
 * ```
 */
export default class EncryptedVault extends Vault {
  /**
   * Creates a new EncryptedVault instance
   *
   * @param config - Encryption configuration (credentials or provider function)
   * @param options - Additional configuration options
   */
  public constructor(
    config: EncryptionConfig,
    options: EncryptedVaultOptions = {}
  ) {
    const { storageName, ...encryptionOptions } = options;

    // Initialize the base Vault
    super(storageName || 'encrypted-vault-storage', true);

    // Apply encryption middleware
    this.use(encryptionMiddleware(config, encryptionOptions));

    // Return the proxied instance using the shared proxy handler
    return new Proxy(this, proxy);
  }
}