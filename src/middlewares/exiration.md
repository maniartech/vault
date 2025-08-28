# Expiration Middleware

## Overview

The Expiration Middleware provides automatic TTL (Time-To-Live) handling and cleanup for vault items. It supports multiple cleanup strategies, from immediate synchronous cleanup to sophisticated background worker-based systems, ensuring both performance and reliability across different use cases.

## Current Implementation

### Architecture
The current implementation uses a **hybrid approach** combining:
1. **Immediate expiry checking** during `getItem()` operations
2. **Background Web Worker** for periodic cleanup
3. **Fallback on-demand sweep** when workers are unavailable
4. **Throttled cleanup** to prevent performance degradation

### Key Components

#### 1. TTL Processing
```typescript
// Supports multiple TTL formats
vault.setItem('key', 'value', { ttl: 1000 });        // milliseconds
vault.setItem('key', 'value', { ttl: '1h' });        // string format
vault.setItem('key', 'value', { expires: new Date() }); // absolute date
```

**Supported formats:**
- `1000` - milliseconds (numeric)
- `'1s'` - seconds
- `'1m'` - minutes
- `'1h'` - hours
- `'1d'` - days
- `Date` objects - absolute expiration time

#### 2. Background Worker System
- **Web Worker** with inline script (no external files)
- **Global registry** for worker management per storage name
- **Periodic cleanup** with configurable intervals (default: 200ms)
- **Batched processing** to maintain performance
- **Graceful degradation** when workers fail

#### 3. Cleanup Strategies
Current implementation uses **lazy cleanup**:
- Items are checked for expiration during `getItem()` operations
- Background worker performs periodic sweeps
- Fallback sweep is throttled (300ms minimum interval)

## Problem Analysis

### Current Issues Identified

#### 1. Test Failures
Three main categories of test failures were identified:

**a) Performance Issues**
- Timeout on large datasets (1000+ items)
- Excessive processing time in test environments

**b) Cleanup Efficiency Issues**
- Items 32-49 out of 50 expired items still returning values
- Background worker not cleaning up efficiently in test scenarios

**c) Race Condition Issues**
- Concurrent access to expiring items causing inconsistent results
- Throttling mechanism preventing proper cleanup during rapid operations

#### 2. Root Causes

**Throttling Bottleneck:**
```typescript
const ONDEMAND_THROTTLE_MS = 300; // Prevents frequent sweeps
```
This throttling prevents cleanup during rapid test operations where multiple `getItem()` calls happen within 300ms.

**Lazy Cleanup Limitation:**
- Only expired items that are accessed get cleaned up
- Unaccessed expired items remain in storage
- `length()` and `keys()` operations may return stale data

**Worker Timing Issues:**
- Background worker operates on different timing than test expectations
- Worker initialization and communication delays
- Browser test environment limitations

## Proposed Enhancement Strategies

### Strategy 1: Immediate Cleanup Mode

**Concept:** Synchronous cleanup on every operation
```typescript
// Immediate mode - every getItem() triggers cleanup
vault.use(expirationMiddleware({ cleanupMode: 'immediate' }));
```

**Pros:**
- Guarantees accurate results
- Predictable behavior for testing
- Simple implementation
- No race conditions

**Cons:**
- Performance impact on get operations
- Blocking operations
- Not suitable for high-throughput scenarios

**Use Cases:**
- Unit testing environments
- Applications requiring strict consistency
- Low-traffic applications

### Strategy 2: Enhanced Background Worker

**Concept:** Military-grade optimized background system
```typescript
// Enhanced background with adaptive scheduling
vault.use(expirationMiddleware({
  cleanupMode: 'background',
  adaptiveScheduling: true,
  circuitBreaker: true,
  memoryPressureAware: true
}));
```

**Features:**
- **Adaptive Scheduling:** Dynamic interval adjustment based on expiration rate
- **Circuit Breaker Pattern:** Resilience against worker failures
- **Memory Pressure Awareness:** Emergency cleanup under memory constraints
- **Load Balancing:** Worker pool for distributed cleanup
- **Performance Monitoring:** Real-time metrics and optimization

**Pros:**
- High performance and scalability
- Non-blocking operations
- Advanced resilience features
- Production-ready optimization

**Cons:**
- Complex implementation
- Eventual consistency model
- Difficult to test reliably
- Resource overhead

**Use Cases:**
- Production environments
- High-throughput applications
- Resource-constrained environments

### Strategy 3: Hybrid Approach (Recommended)

**Concept:** Best of both worlds with configurable behavior
```typescript
// Hybrid mode with intelligent switching
vault.use(expirationMiddleware({
  cleanupMode: 'hybrid',
  immediateThreshold: 10,  // Switch to immediate for small operations
  backgroundThreshold: 100 // Use background for large operations
}));
```

**Features:**
- **Immediate cleanup** for accessed items
- **Background cleanup** for bulk operations
- **Configurable thresholds** for switching modes
- **Test environment detection** for automatic mode selection
- **Performance-based adaptation**

**Pros:**
- Balanced performance and accuracy
- Suitable for both testing and production
- Configurable behavior
- Graceful degradation

**Cons:**
- More complex than single-strategy approaches
- Requires careful configuration
- Additional testing overhead

**Use Cases:**
- Universal solution for all environments
- Applications with mixed workload patterns
- Development and production parity

### Strategy 4: Event-Driven Cleanup

**Concept:** Reactive cleanup based on system events
```typescript
// Event-driven cleanup
vault.use(expirationMiddleware({
  cleanupMode: 'event-driven',
  triggers: ['memory-pressure', 'idle-time', 'batch-operations']
}));
```

**Features:**
- **Memory pressure triggers:** Cleanup when memory usage exceeds thresholds
- **Idle time cleanup:** Aggressive cleanup during application idle periods
- **Batch operation triggers:** Cleanup during bulk operations
- **User interaction triggers:** Cleanup during natural pause points

**Pros:**
- Resource-efficient
- Responsive to system conditions
- Non-intrusive during active periods

**Cons:**
- Complex trigger management
- Unpredictable cleanup timing
- Requires sophisticated monitoring

**Use Cases:**
- Mobile applications
- Resource-constrained environments
- Applications with predictable usage patterns

## Advanced Patterns and Optimizations

### 1. Multi-Tier Cleanup Architecture

```typescript
// Four-tier cleanup system
const CLEANUP_TIERS = {
  IMMEDIATE: 'immediate',    // On access (0ms delay)
  AGGRESSIVE: 'aggressive',  // High frequency (50ms interval)
  BACKGROUND: 'background',  // Normal frequency (200ms interval)
  EMERGENCY: 'emergency'     // Memory pressure response
};
```

**Tier 1: Immediate**
- Triggered during `getItem()`, `setItem()` operations
- Synchronous cleanup of accessed items
- Guarantees accuracy for critical operations

**Tier 2: Aggressive**
- Triggered during high expiration rate periods
- 50ms interval cleanup
- Adaptive based on expiration metrics

**Tier 3: Background**
- Standard periodic cleanup
- 200ms default interval
- Worker-based for performance

**Tier 4: Emergency**
- Memory pressure response
- Forced synchronous cleanup
- Circuit breaker activation

### 2. Adaptive Scheduling Algorithm

```typescript
class ExpirationScheduler {
  adjustScheduling(metrics: CleanupMetrics) {
    const expirationRate = metrics.expired / metrics.processed;

    if (expirationRate > 0.15) {
      // High expiration rate - aggressive cleanup
      this.interval = Math.max(50, this.interval * 0.8);
      this.batchSize = Math.min(200, this.batchSize * 1.2);
    } else if (expirationRate < 0.05) {
      // Low expiration rate - conservative cleanup
      this.interval = Math.min(1000, this.interval * 1.1);
      this.batchSize = Math.max(50, this.batchSize * 0.9);
    }
  }
}
```

### 3. Circuit Breaker Implementation

```typescript
class ExpirationCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds

  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        return null; // Fast fail
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### 4. Memory Pressure Monitoring

```typescript
// Memory-aware cleanup triggers
function initMemoryMonitoring() {
  if ('memory' in performance) {
    const checkMemory = () => {
      const memInfo = (performance as any).memory;
      const usage = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;

      if (usage > 0.8) {
        triggerEmergencyCleanup();
      } else if (usage > 0.6) {
        triggerAggressiveCleanup();
      }
    };

    setInterval(checkMemory, 5000);
  }
}
```

## Testing Strategies

### Current Testing Challenges

1. **Mode-Specific Testing:** Need to test each cleanup strategy independently
2. **Timing Dependencies:** Background workers introduce timing complexities
3. **Environment Differences:** Browser vs Node.js vs test environment variations
4. **Performance Validation:** Need to verify performance characteristics of each strategy

### Recommended Testing Approach

#### 1. Strategy-Specific Test Suites

```javascript
describe('Expiration Middleware Strategies', () => {
  describe('Immediate Mode', () => {
    it('should clean up expired items synchronously', async () => {
      vault.use(expirationMiddleware({ cleanupMode: 'immediate' }));
      // Test immediate cleanup behavior
    });
  });

  describe('Background Mode', () => {
    it('should clean up expired items via worker', async () => {
      vault.use(expirationMiddleware({ cleanupMode: 'background' }));
      // Test background cleanup with proper timing
    });
  });

  describe('Hybrid Mode', () => {
    it('should balance immediate and background cleanup', async () => {
      vault.use(expirationMiddleware({ cleanupMode: 'hybrid' }));
      // Test hybrid behavior
    });
  });
});
```

#### 2. Performance Testing Matrix

| Strategy | Test Type | Metrics | Validation |
|----------|-----------|---------|------------|
| Immediate | Unit | Synchronous timing | < 1ms per operation |
| Background | Integration | Asynchronous cleanup | < 500ms total |
| Hybrid | End-to-End | Mixed workload | Balanced performance |

#### 3. Stress Testing Scenarios

**High-Frequency Access Test:**
```javascript
it('should handle rapid access patterns', async () => {
  // 1000 operations in 100ms
  const operations = Array.from({ length: 1000 }, (_, i) =>
    vault.getItem(`key-${i}`)
  );

  const startTime = performance.now();
  await Promise.all(operations);
  const duration = performance.now() - startTime;

  expect(duration).toBeLessThan(500); // Strategy-specific threshold
});
```

**Memory Pressure Test:**
```javascript
it('should handle memory pressure gracefully', async () => {
  // Fill memory with large items
  const largeData = 'x'.repeat(1024 * 1024); // 1MB string

  for (let i = 0; i < 100; i++) {
    await vault.setItem(`large-${i}`, largeData, { ttl: 50 });
  }

  // Verify cleanup occurs under memory pressure
  await new Promise(resolve => setTimeout(resolve, 200));

  const finalLength = await vault.length();
  expect(finalLength).toBe(0);
});
```

#### 4. Worker Validation Tests

```javascript
it('should verify background worker functionality', async () => {
  vault.use(expirationMiddleware({ cleanupMode: 'background' }));

  // Verify worker is created and registered
  const registry = globalThis.__vaultExpirationWorkerRegistry__;
  expect(registry.has(vault.storageName)).toBe(true);

  const workerEntry = registry.get(vault.storageName);
  expect(workerEntry.worker).toBeInstanceOf(Worker);
  expect(workerEntry.health).toBe('healthy');
});
```

#### 5. Cross-Environment Testing

**Browser Environment:**
- Web Worker availability
- IndexedDB performance
- Memory API support

**Node.js Environment:**
- Worker threads behavior
- File system storage
- Memory monitoring alternatives

**Test Environment:**
- Timing reliability
- Mock worker capabilities
- Deterministic behavior

## Configuration Options

### Current Configuration
```typescript
interface ExpirationOptions {
  defaultTTL?: number;
}
```

### Enhanced Configuration (Proposed)
```typescript
interface ExpirationOptions {
  // Basic options
  defaultTTL?: number;
  cleanupMode?: 'immediate' | 'background' | 'hybrid' | 'event-driven';

  // Performance tuning
  workerInterval?: number;        // Background worker frequency
  throttleMs?: number;           // Minimum time between on-demand sweeps
  batchSize?: number;            // Items processed per cleanup batch
  maxCleanupTime?: number;       // Maximum time per cleanup cycle

  // Advanced features
  adaptiveScheduling?: boolean;   // Enable dynamic interval adjustment
  circuitBreaker?: boolean;      // Enable worker failure protection
  memoryPressureAware?: boolean; // Enable memory-based cleanup triggers

  // Monitoring and debugging
  enableMetrics?: boolean;       // Collect performance metrics
  debugMode?: boolean;          // Enable detailed logging

  // Strategy-specific options
  immediateThreshold?: number;   // Items count for immediate mode switch
  backgroundThreshold?: number;  // Items count for background mode switch

  // Resilience options
  maxWorkerFailures?: number;    // Circuit breaker threshold
  workerRecoveryTime?: number;   // Circuit breaker timeout
  fallbackEnabled?: boolean;     // Enable fallback cleanup
}
```

## Implementation Roadmap

### Phase 1: Core Strategy Implementation (Current Priority)
1. **Implement configurable cleanup modes**
2. **Fix existing test failures**
3. **Add strategy-specific test suites**
4. **Document configuration options**

### Phase 2: Advanced Features
1. **Adaptive scheduling algorithm**
2. **Circuit breaker implementation**
3. **Memory pressure monitoring**
4. **Performance metrics collection**

### Phase 3: Optimization and Monitoring
1. **Worker pool implementation**
2. **Cross-environment compatibility**
3. **Performance benchmarking**
4. **Production monitoring tools**

### Phase 4: Advanced Patterns
1. **Event-driven cleanup**
2. **Machine learning-based optimization**
3. **Distributed cleanup coordination**
4. **Advanced caching strategies**

## Industry Best Practices Applied

### 1. Circuit Breaker Pattern
- **Purpose:** Prevent cascade failures in distributed systems
- **Implementation:** Automatic worker failure detection and recovery
- **Benefits:** System resilience and graceful degradation

### 2. Backpressure Management
- **Purpose:** Prevent system overload during high-traffic periods
- **Implementation:** Time-boxed operations with yielding
- **Benefits:** Maintains responsiveness under load

### 3. Adaptive Algorithms
- **Purpose:** Self-optimizing system behavior
- **Implementation:** Dynamic scheduling based on metrics
- **Benefits:** Automatic performance tuning

### 4. Multi-Tier Architecture
- **Purpose:** Separation of concerns and performance optimization
- **Implementation:** Different cleanup strategies for different scenarios
- **Benefits:** Balanced performance and resource utilization

### 5. Health Monitoring
- **Purpose:** Proactive system maintenance and debugging
- **Implementation:** Worker health tracking and metrics collection
- **Benefits:** Early problem detection and optimization opportunities

## Best Practices and Lessons Learned: Dos and Don'ts

Based on the challenges and solutions discovered while fixing and enhancing the expiration middleware, here are key best practices for developers to follow.

### For Testing Expiration Logic

| Category | Dos | Don'ts |
| :--- | :--- | :--- |
| **Asynchronous Behavior** | **DO** use robust patterns for testing async operations. Create polling helpers (`waitForWorker`) to check for a specific state (e.g., worker is 'healthy') before making assertions. | **DON'T** rely on fixed timers (`setTimeout`) to wait for background tasks to complete. This is a primary source of flaky tests. |
| **Test Isolation** | **DO** use `afterEach` hooks to rigorously clean up resources. Terminate workers, clear vault storage, and reset any global registries to prevent state from leaking between tests. | **DON'T** assume tests run in a clean environment. A failing test can leave resources behind that cause subsequent tests to fail unpredictably. |
| **Strategy-Specific Tests** | **DO** tailor your tests to the `cleanupMode`. Test `'immediate'` mode for synchronous, predictable behavior and `'background'` mode with asynchronous patterns. | **DON'T** use a one-size-fits-all test for different cleanup strategies. An assertion that passes in immediate mode may fail in background mode due to timing. |
| **Output Cleanliness** | **DO** keep test output clean and focused on results. | **DON'T** leave `console.log` statements in your test files. They add noise and can obscure important failure information in CI/CD logs. |

### For Using the Middleware in Applications

| Category | Dos | Don'ts |
| :--- | :--- | :--- |
| **Configuration** | **DO** choose your `cleanupMode` based on your application's needs. Use `'background'` or `'hybrid'` for performance-critical UIs; use `'immediate'` for scripts or environments needing strict consistency. | **DON'T** forget that the default mode is `'background'`. If you need synchronous cleanup, you must explicitly set the mode to `'immediate'`. |
| **Data Consistency** | **DO** understand that with background cleanup, an item might be expired (and `getItem` returns `null`) but not yet removed from underlying storage. | **DON'T** rely on `length()` or `keys()` to be instantly consistent after an item expires in background mode. These operations will become consistent after the next cleanup cycle. |
| **Error Handling** | **DO** build your application to be resilient to caching errors. The middleware is designed to fail gracefully, but your code should handle potential `null` returns gracefully. | **DON'T** assume the cache will always be available or that items will always exist. |
| **Performance** | **DO** consider the performance trade-offs. `'immediate'` cleanup can add a small overhead to data access operations, while `'background'` cleanup uses a separate thread to minimize main thread impact. | **DON'T** use `'immediate'` mode in high-throughput scenarios where every millisecond of main thread performance counts. |

## Future Considerations

### 1. Machine Learning Integration
- **Predictive expiration:** Use ML to predict optimal cleanup timing
- **Usage pattern analysis:** Optimize based on application usage patterns
- **Anomaly detection:** Identify unusual expiration patterns

### 2. Distributed Coordination
- **Multi-tab coordination:** Coordinate cleanup across browser tabs
- **Cross-device synchronization:** Sync expiration across devices
- **Cluster coordination:** Coordinate cleanup in distributed applications

### 3. Advanced Caching
- **Lazy loading:** Load items only when needed
- **Predictive caching:** Cache items likely to be accessed
- **Intelligent eviction:** Smart cache eviction based on access patterns

### 4. Real-time Monitoring
- **Live performance dashboards:** Real-time cleanup performance monitoring
- **Alerting systems:** Automated alerts for performance degradation
- **A/B testing framework:** Test different cleanup strategies in production

## Conclusion

The Expiration Middleware represents a critical component of the vault system, requiring careful balance between performance, accuracy, and reliability. The proposed multi-strategy approach with configurable behavior provides the flexibility needed for both development and production environments while maintaining the robustness required for mission-critical applications.

The implementation should prioritize:
1. **Correctness** - Reliable expiration behavior
2. **Performance** - Minimal impact on application performance
3. **Flexibility** - Configurable for different use cases
4. **Reliability** - Graceful handling of failures and edge cases
5. **Observability** - Clear metrics and debugging capabilities

This comprehensive approach ensures the middleware can adapt to various requirements while maintaining high standards of quality and performance.