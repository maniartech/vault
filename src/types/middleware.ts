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
  /** The value being set (for set operations) */
  value?: any;
  /** The metadata being set or retrieved */
  meta?: VaultItemMeta | null;
  /** The vault instance (added by middleware pipeline) */
  vaultInstance?: any;
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

