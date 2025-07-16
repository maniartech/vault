/**
 * Minimal test to verify expiration middleware core functionality
 */

import Vault from '../vault.js';
import { expirationMiddleware } from '../middlewares/expiration.js';

describe('Expiration Middleware - Core Functionality', () => {
  let vault;

  afterEach(async () => {
    if (vault) {
      await vault.clear();
    }
  });

  it('should convert TTL to expires timestamp', async () => {
    vault = new Vault('test-ttl-conversion');
    vault.use(expirationMiddleware());
    
    await vault.setItem('key', 'value', { ttl: 1000 });
    
    const meta = await vault.getItemMeta('key');
    console.log('TTL conversion - Meta:', meta);
    
    expect(meta).not.toBeNull();
    expect(meta.expires).toBeDefined();
    expect(typeof meta.expires).toBe('number');
    expect(meta.ttl).toBeUndefined();
  });

  it('should apply default TTL', async () => {
    vault = new Vault('test-default-ttl');
    vault.use(expirationMiddleware(1000)); // 1 second default
    
    await vault.setItem('key', 'value'); // No explicit TTL
    
    const meta = await vault.getItemMeta('key');
    console.log('Default TTL - Meta:', meta);
    
    expect(meta).not.toBeNull();
    expect(meta.expires).toBeDefined();
    expect(typeof meta.expires).toBe('number');
  });

  it('should detect expired items', async () => {
    vault = new Vault('test-expiration');
    vault.use(expirationMiddleware());
    
    await vault.setItem('key', 'value', { ttl: 1 }); // 1ms
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const result = await vault.getItem('key');
    console.log('Expiration check - Result:', result);
    
    expect(result).toBeNull();
  });
});