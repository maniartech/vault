# Changelog

All notable changes to this project will be documented in this file.

This project adheres to semantic versioning. Dates are in YYYY-MM-DD.

## [2.0.0] - 2025-11-06

A major re-architecture of Vault Storage focused on extensibility, security, and developer experience.

### 🚀 New
- Middleware architecture for storage operations (before/after/error hooks)
- EncryptedVault class for easy, secure storage using Web Crypto (AES-GCM)
- Expiration middleware with four cleanup strategies: immediate, background, hybrid, proactive
- Validation middleware with custom validator support for all operations
- Event system using EventTarget to react to set/get/delete/clear
- TypeScript-first APIs and comprehensive `.d.ts` typings across the package
- ES module build and modern exports for optimal tree-shaking
- Pre-publish validation scripts, size checks, and pack inspection utilities

### 🔧 Changes
- Default entry now points to a minimal singleton (`index.mini.js`) for ~2KB gzipped usage
- Full API available via `dist/index.js` (~3KB gzipped) with named exports
- Reworked exports map for direct imports: `vault`, `encrypted-vault`, `middlewares/*`, `types`
- Improved proxy handler for safer property access and chainable methods
- Many refinements in error handling, metadata, and async behavior

### 🧹 Removed / Deprecated
- Removed legacy `SecuredVault` class; use `EncryptedVault` or encryption middleware
- Cleaned up old test suites and scripts in favor of a focused, faster setup

### 🧪 Tests
- 350+ tests covering core, middlewares, events, performance, and legacy patterns
- Stress and performance tests for middleware overhead and resilience
- Import/compatibility tests for package entry points

### 📚 Documentation
- Updated README with v2.0 architecture, examples, and migration
- New docs: API references (Vault, Middlewares), Getting Started, Events, Future Ideas
- Rewritten article for Medium: why Vault Storage makes you forget LocalStorage

### 🛠 Build & Tooling
- ESBuild-based bundling with declaration emit via TypeScript
- Size measurement and gating via `scripts/gzip-and-measure.js`
- Pre-publish validation with checks for dist files, sizes, tests, and package content

### ⚠ Breaking Changes
- `SecuredVault` → removed; migrate to `EncryptedVault`
- ES modules only; import paths updated for improved tree-shaking
- Some constructor/config signatures changed to separate encryption config from options

---

[2.0.0-alpha.1]: https://github.com/maniartech/vault/compare/b6ad98d...HEAD
