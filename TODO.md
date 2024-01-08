# Vault TODO Items

Since the vault is baesd on IndexDB database as storage provider, it is possible
to make it more powerful and useful. Here are some planned features and their
implementation status.

## Core Features

- [x] Extensible Vault class that has following qualities

      - Provides a simple interface similar to local and session storages
      - Supports indexers and dot notation for intuitive and ergonomic access
      - Store large amount of data
      - Perorm transactional in non-blocking asynchronous manner
- [x] Global default vault instance for ease of use
- [x] Support custom storages and databases

## Advanced Features - Middleware and Encryption

- [x] Middleware support
- [ ] Support encrypted values to safeguard sensitive data in the vault
- [ ] Support custom encryption and decryption

## Other Advanced Features

- [ ] Support multiple update in a single transaction
- [ ] Automatic expiration of values based on TTL, Session Timeout and other
      expiration policies
- [ ] Support for vault data backup and restore
