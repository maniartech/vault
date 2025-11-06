# Vault Storage Documentation

Complete documentation for Vault Storage v2.0 - a sophisticated browser-based storage library.

## 📚 Table of Contents

### Getting Started
- [Quick Start Guide](guides/getting-started.md) - Get up and running in minutes
- [Migration from v1.x](guides/migration.md) - Upgrade guide for existing users
- [Installation & Setup](guides/installation.md) - Detailed installation instructions

### API Reference
- [Vault Class](api/vault.md) - Core Vault API reference
- [EncryptedVault Class](api/encrypted-vault.md) - Encrypted storage API
- [Middlewares](api/middlewares.md) - All available middleware
  - [Encryption Middleware](api/middlewares.md#encryption-middleware)
  - [Validation Middleware](api/middlewares.md#validation-middleware)
  - [Expiration Middleware](api/middlewares.md#expiration-middleware)
- [Backup & Restore](api/backup.md) - Import/Export functionality
- [Events System](api/events.md) - Event handling API

### Usage Guides
- [Basic Usage](guides/basic-usage.md) - Common patterns and examples
- [Encryption & Security](guides/encryption.md) - Secure data storage
- [Data Expiration](guides/expiration.md) - TTL and automatic cleanup
- [Validation](guides/validation.md) - Data validation patterns
- [Events & Reactivity](guides/events.md) - Working with storage events
- [Multiple Stores](guides/multiple-stores.md) - Managing multiple vaults
- [Metadata](guides/metadata.md) - Working with item metadata

### Advanced Topics
- [Custom Middleware](guides/custom-middleware.md) - Building your own middleware
- [Performance Optimization](guides/performance.md) - Best practices
- [TypeScript Usage](guides/typescript.md) - Type-safe patterns
- [Testing Strategies](guides/testing.md) - How to test vault usage

### Developer Documentation
- [Package Commands](PACKAGE_COMMANDS.md) - Package preview & inspection tools
- [Events Implementation](implementation/events-handling.md) - Events system internals

### Future Features (Proposals)
- [Browser Sync Middleware](proposals/browser-sync-middleware.md) - Cross-tab synchronization
- [Diff Change Middleware](proposals/diff-change-middleware.md) - Rich change events
- [Universal Storage](proposals/universal-storage.md) - Node.js, Deno, Bun support
- [Enhanced Cache](proposals/update.md) - Advanced caching strategies

### Articles & Blog Posts
- [Why VaultStorage Over LocalStorage](article.md) - Comparison and benefits

## 🚀 Quick Links

### For New Users
1. [Quick Start Guide](guides/getting-started.md)
2. [Basic Usage Examples](guides/basic-usage.md)
3. [Vault API Reference](api/vault.md)

### For v1.x Users
1. [Migration Guide](guides/migration.md)
2. [What's New in v2.0](guides/whats-new-v2.md)
3. [Breaking Changes](guides/migration.md#breaking-changes)

### For Advanced Users
1. [Custom Middleware](guides/custom-middleware.md)
2. [Performance Guide](guides/performance.md)
3. [TypeScript Patterns](guides/typescript.md)

## 📖 Documentation Status

| Document | Status | Description |
|----------|--------|-------------|
| Quick Start | ✅ Complete | Get started quickly |
| API Reference | ✅ Complete | Full API documentation |
| Migration Guide | ✅ Complete | v1.x to v2.0 upgrade |
| Usage Guides | ✅ Complete | Common patterns |
| Custom Middleware | ✅ Complete | Building middleware |
| Proposals | 📝 Future | Planned features |

## 🤝 Contributing to Documentation

Found an error or want to improve the documentation?

1. Documentation is in `docs/`
2. Follow the existing structure
3. Include code examples
4. Test all code snippets
5. Update the index (this file)

## 📝 Documentation Conventions

- **Code Examples**: All examples use modern ES6+ syntax
- **Async/Await**: We prefer async/await over promises
- **TypeScript**: Type annotations included where helpful
- **Comments**: Explain the "why", not just the "what"

## 🔗 External Resources

- [GitHub Repository](https://github.com/maniartech/vault)
- [NPM Package](https://www.npmjs.com/package/vault-storage)
- [Issue Tracker](https://github.com/maniartech/vault/issues)
- [Changelog](../CHANGELOG.md)

## 📄 License

Vault Storage is [MIT licensed](../LICENSE).
