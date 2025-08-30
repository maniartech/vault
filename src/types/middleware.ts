/**
 * Middleware system types for Vault Storage
 */

import { VaultItemMeta } from './vault.js';

/**
 * Context object passed through the middleware pipeline
 */
export interface MiddlewareContext {
  /** The operation being performed */
  operation: 'get' | 'set' | 'remove' | 'clear' | 'keys' | 'length' | 'getItemMeta';
  /** The key being operated on (if applicable) */
  key?: string;
  /** The value being set or retrieved (uses smart getter/setter for retrieved values) */
  value?: any;
  /** The metadata being set or retrieved (uses smart getter/setter for retrieved metadata) */
  meta?: VaultItemMeta | null;
  /** The previous value before set operation (only available during 'set' operations) */
  previousValue?: any;
  /** The previous metadata before set operation (only available during 'set' operations) */
  previousMeta?: VaultItemMeta | null;
  /** The vault instance (added by middleware pipeline) */
  vaultInstance?: any;
  /** Confirmation flag for clear operations */
  confirmClear?: boolean;
  /** Additional context data that middleware can use */
  [key: string]: any;
}

/**
 * Middleware interface for extending vault functionality
 */
export interface Middleware {
  /** Unique name for the middleware */
  name: string;

  /**
   * Called when the middleware is registered with a vault instance.
   * Ideal for initialization tasks.
   */
  onRegister?(vaultInstance: any): void;

  /**
   * Called before the operation is executed
   * Can modify the context or throw errors to prevent execution
   */
  before?(context: MiddlewareContext): Promise<MiddlewareContext> | MiddlewareContext;

  /**
   * Called after the operation is executed successfully
   * Can modify the result before it's returned
   */
  after?(context: MiddlewareContext, result: any): Promise<any> | any;

  /**
   * Called when an error occurs during operation
   * Can handle, transform, or re-throw errors
   */
  error?(context: MiddlewareContext, error: Error): Promise<Error | void> | Error | void;
}

