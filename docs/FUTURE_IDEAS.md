# Future Ideas for Vault Storage

This document contains ideas and concepts being explored for future versions of Vault Storage. These are **not committed features** or a roadmap, but rather a collection of possibilities that may or may not be implemented depending on community feedback and use cases.

> **Note:** Items here may require breaking changes and would likely be part of a future major version (v3.0+).

---

## Storage Adapters (Cross-Platform Support)

**Idea:** Make storage backend swappable to support different runtimes.

Currently, Vault is browser-focused using IndexedDB. The idea is to abstract storage behind an adapter interface, allowing:

- **Browser:** IndexedDB (current default) + OPFS (large-scale persistent browser storage, supports multi-GB datasets)
- **Node.js/Bun/Deno:** File-based or in-memory storage
- **Universal:** In-memory adapter for testing

**Status:** Architectural exploration
**Related Docs:** `universal-storage.md` (design document)
**Challenges:** Would require significant architectural changes to the core

### Quality & Robustness Requirements

These adapters are intended for mission-critical use cases and must meet strict requirements:

- **Durability:** Atomic writes, crash-safe commits, and verified recovery on restart.
- **Consistency:** Deterministic ordering and strict read-after-write behavior.
- **Thread safety:** Explicit locking/transaction boundaries; no shared mutable state without guards.
- **Data integrity:** Checksums, corruption detection, and fail-closed behavior.
- **Security:** Auditable crypto, key rotation support, and tamper-evident logs where applicable.
- **Performance:** Low-latency operations with clear SLO targets ($p50$, $p95$, $p99$).
- **Testing:** Fuzzing, fault injection, soak tests, and crash-recovery test matrix across runtimes.

### Single Public Adapter, Multiple Runtime Implementations

Use one top-level adapter name (`file`) that works across server runtimes, while delegating to runtime-specific sub-adapters under the hood:

- `file` (public): one entrypoint that detects Node/Bun/Deno at runtime
- `file/node`: Node-specific file system implementation
- `file/bun`: Bun-specific file system implementation
- `file/deno`: Deno-specific file system implementation

This keeps the API simple for users while isolating platform details and avoiding cross-runtime bundling issues.

### Serialization & Data Format (File + OPFS)

Both file and OPFS adapters share identical serialization and durability strategies to ensure consistency across platforms:

**Format & Encoding:**
- **MessagePack** for compact binary serialization (lightweight, fast, cross-platform)
- Version header for forward compatibility
- Per-record type markers for polymorphic data

**Durability & Safety:**
- **Write-Ahead Log (WAL):** All mutations logged before commit; enables crash recovery
- **Checksums:** CRC32 or SHA256 per record for corruption detection
- **Atomic commits:** Rename/swap for atomic file transitions (POSIX) or OPFS transactions
- **Fail-closed:** Unverified/corrupted records are rejected; system reverts to last good state

**Storage Quota Management (OPFS):**
- Request persistent storage: `navigator.storage.persist()` for user consent
- Query quota: `navigator.storage.estimate()` for available/usage bytes
- Support multi-GB datasets (browser quota typically 50% of device storage)
- Graceful degradation when quota exhausted

**Shared Code Structure:**
- `core/serializers/` – MessagePack encoding, checksum calculation
- `core/wal.ts` – Write-Ahead Log protocol (format-agnostic)
- `core/transaction.ts` – Atomic write boundaries
- `adapters/file/` – File I/O using shared serializers
- `adapters/opfs/` – OPFS I/O using shared serializers

This design ensures byte-for-byte format compatibility: data written by file adapter can be read by OPFS and vice versa.

```typescript
// Conceptual API
const vault = new Vault('my-app', {
  adapter: 'file',
  path: './data'
});
```

---

## Cross-Tab Synchronization Middleware

**Idea:** Automatically sync storage changes across browser tabs/windows.

Using BroadcastChannel API to propagate changes in real-time across same-origin contexts.

**Status:** Design phase
**Related Docs:** `browser-sync-middleware.md` (design document)
**Benefits:**
- Keep multiple tabs in sync
- Real-time collaboration features
- Shared state management

```javascript
// Conceptual API
vault.use(syncMiddleware({
  channel: 'my-app-sync'
}));
```

---

## Rich Change Events (Diff Middleware)

**Idea:** Emit detailed change events with previous/next values.

Currently, events are lightweight. This would add optional middleware for rich diffs.

**Status:** Design phase
**Related Docs:** `diff-change-middleware.md` (design document)
**Use Cases:**
- Undo/redo functionality
- Change tracking/auditing
- Reactive UI updates

```javascript
// Conceptual API
vault.use(diffChangeMiddleware());

vault.on('change:value', (event) => {
  console.log('Before:', event.detail.previousValue);
  console.log('After:', event.detail.nextValue);
});
```

---

## Performance & Query Optimization

**Ideas for improving performance at scale:**

### Indexing Support
- Add secondary indexes for faster lookups
- Query by metadata properties
- Range queries

### Batch Operations
- `setItems(items)` - bulk insert
- `getItems(keys)` - bulk retrieve
- Optimized for large datasets

### Memory Optimization
- Streaming large values
- Lazy loading strategies
- Memory-mapped storage

**Status:** Research phase
**Challenges:** Must maintain simplicity while adding power

---

## Developer Experience Enhancements

### DevTools Integration
- Chrome/Firefox extension for inspecting vault storage
- Visual data browser
- Real-time change monitoring
- Performance profiling

### Schema Validation Middleware
- JSON Schema validation
- TypeScript runtime validation (Zod, Yup integration)
- Automatic migration on schema changes

### Compression Middleware
- Automatic compression for large values
- Configurable compression algorithms
- Transparent decompression

**Status:** Ideas stage
**Community Input Needed:** What would be most valuable?

---

## Framework Integrations

**Idea:** Official packages for popular frameworks.

### React
```javascript
// Conceptual API
import { useVault } from '@vault-storage/react';

function Component() {
  const [user, setUser] = useVault('user');
  // ...
}
```

### Vue
```javascript
// Conceptual API
import { useVault } from '@vault-storage/vue';

export default {
  setup() {
    const user = useVault('user');
    // ...
  }
}
```

### Svelte
```javascript
// Conceptual API
import { vault } from '@vault-storage/svelte';

const user = vault('user');
```

**Status:** Community interest gathering
**Approach:** Separate packages to keep core small

---

## Advanced Middleware Ideas

### Rate Limiting Middleware
- Throttle operations
- Prevent abuse
- Quota management

### Retry Middleware
- Automatic retry on failures
- Exponential backoff
- Error recovery

### Conflict Resolution Middleware
- LWW (Last Write Wins)
- Custom merge strategies
- Version vectors

### Encryption Enhancements
- Multiple encryption algorithms
- Key rotation support
- Per-field encryption

**Status:** Concept exploration

---

## Migration & Compatibility Tools

### Automatic Migration Utilities
- Migrate from v1.x to v2.x
- Migrate from LocalStorage
- Data transformation helpers

### Version Management
- Schema versioning
- Backward compatibility layers
- Graceful degradation

**Status:** Based on real-world migration pain points

---

## Testing & Development

### Mock Adapters
- In-memory testing
- Predictable async behavior
- Fixture support

### Debug Middleware
- Operation logging
- Performance tracking
- State snapshots

**Status:** Could be part of v2.x

---

## Community Requests

This section will be populated based on:
- GitHub issues
- User feedback
- Real-world use cases
- Pain points discovered

**How to contribute ideas:**
1. Open a GitHub issue with the `idea` label
2. Describe the use case and problem
3. Suggest potential API design
4. Community discussion and refinement

---

## What WON'T Be Included

To maintain focus and simplicity, here's what we're explicitly **not** planning:

- ❌ Server-side features (Vault is client-focused)
- ❌ GraphQL/REST API generation
- ❌ Built-in UI components
- ❌ Complex query language (keep it simple)
- ❌ Bloated dependencies
- ❌ Breaking the simple API promise

---

## Guiding Principles for Future Development

When evaluating ideas, we consider:

1. **Simplicity First:** Does it maintain the simple API?
2. **Bundle Size:** Can it be optional/tree-shakeable?
3. **Real Use Cases:** Is there demonstrated need?
4. **Middleware First:** Can it be a middleware instead of core?
5. **Breaking Changes:** Can it be done without breaking existing code?
6. **TypeScript Support:** Does it work well with types?
7. **Testing:** Can it be well-tested?
8. **Documentation:** Can it be clearly explained?

---

## Current Focus (v2.0)

The current version (v2.0) is **feature-complete** and production-ready with:

✅ Core vault operations
✅ Middleware system
✅ Encryption (EncryptedVault)
✅ Validation
✅ Expiration with multiple strategies
✅ Events system
✅ TypeScript support
✅ Comprehensive testing
✅ Full documentation

**Next immediate steps:**
- Gather real-world usage feedback
- Fix any bugs discovered
- Performance optimization based on metrics
- Minor improvements based on user feedback

---

## How Ideas Become Features

1. **Idea** → Discussed in GitHub issues
2. **Proposal** → Design document created (like those in `docs/`)
3. **Prototype** → Proof of concept implementation
4. **Feedback** → Community testing and refinement
5. **RFC** → Formal request for comments
6. **Implementation** → Added to a release
7. **Documentation** → Full docs and examples
8. **Release** → Shipped in a version

Most ideas never make it past step 1 or 2, and that's okay!

---

## Contributing Ideas

We welcome ideas! Here's how:

1. **Check existing ideas** in this document and GitHub issues
2. **Open a GitHub issue** with:
   - Clear use case description
   - Why existing features don't solve it
   - Proposed API design (optional)
   - Willingness to help implement (optional)
3. **Join the discussion** on existing ideas
4. **Build a proof of concept** as middleware (best way to validate)

**Remember:** Not all ideas will be implemented. We're very protective of:
- Bundle size
- API simplicity
- Backward compatibility
- Maintenance burden

---

**Last Updated:** November 6, 2025
**For Current Features:** See main [README.md](../README.md)
**For Documentation:** See [docs/README.md](README.md)
