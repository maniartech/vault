# vault

`vault` is a sophisticated browser-based storage library that leverages the power
of IndexedDB, offering significant improvements over traditional LocalStorage.
As a high-performance, asynchronous solution for client-side storage, `vault`
provides an intuitive and easy-to-use API to interact with IndexedDB, making
client-side data storage efficient and scalable.

## Features

- **Similar API**: Easy to use, similar to LocalStorage.
- **Lightweight**: No dependencies, micro footprint (Less than a KB minified and gzipped).
- **Asynchronous**: Non-blocking, asynchronous API.
- **Structured Data**: Supports structured data, including objects and arrays.

## Installation

Install `vault-storage` using npm:

```bash
npm install vault-storage --save
```

Or using yarn:

```bash
yarn add vault-storage
```

## Usage

First, import `vault-storage` in your project:

```javascript
import vault from 'vault-storage';
```

### Initializing and Setup

By default, the `vault` does not need any special initialization or setup!!!
In this way, it behaves similar to the local and session storages, It uses
default database and store names.

> **Just start using it!**

```javascript
// Set the values.
vault.key1 = "value1";
vault.key2 = "value2";

// Get the values. Remember to use await! As it's asynchronous.
const value1 = await vault.key1; // "value1"
const value2 = await vault.key2; // "value2"
```

### Custom Storage

You can also use a custom database name and store name. This is useful when you
want to use multiple databases or stores.

```javascript
import Vault from 'vault-storage/vault';


const myStorage = new Vault("my-storage")
myStorage.setItem("key", "value")
console.log("key", await myStorage.getItem("key"))
```

### Custom Secure Database

Secured databases are useful when you want to store sensitive data. It provides
similar API to the `vault` but it encrypts the data before storing it in the
database. It uses browser's native crypto API to encrypt the data.

```javascript
import SecuredVault from 'vault-storage/secured';

// Secured storage using fixed password and salt.
const securedStorage1 = new SecuredVault("secured-storage", {
  password: "my-password",
  salt: "my-salt",
});

// Secured storage using dynamic password and salt.
const securedStorage2 = new SecuredVault("secured-storage", (key) => {
  const password = key.startsWith("key1") ? "my-password1" : "my-password2";
  const salt = key.startsWith("key1") ? "my-salt1" : "my-salt2";
  return { password, salt };
});

// Secured storage using promise based password and salt.
const securedStorage3 = new SecuredVault("secured-storage", async (key) => {
  return new Promise(async (resolve) => {
    const res = await fetch("/get-key")
    const { password, salt } = generatePasswordFromKey(res.key)
    resolve({ password, salt })
  });
});

// Once the secured valued is setup, usage is similar to the regular vault storage.
// Just start using it!

// Set the values. It stores the encrypted Uint8Array in the database
// against the key.
securedStorage1.key1 = "value1";

// Get the values. Remember to use await! As it's asynchronous.
const value1 = await securedStorage1.key1; // "value1"
```

### Setting Values

Store data using the `setItem` method, indexer syntax, or dot notation:

```javascript

 // For set operation you can ignore await unless you want to wait for the
 // operation to complete or you want to catch any errors.
vault.setItem('yourKey', { any: 'data' });

// Indexer syntax.
vault['yourKey'] = { any: 'data' };

// Dot notation.
vault.yourKey = { any: 'data' };
```

### Getting Values

Retrieve data using the `getItem` method, indexer syntax, or dot notation. For get
operations you must use await as it's asynchronous.

```javascript
// Get the value using the getItem method.
const data = await vault.getItem('yourKey');

// Indexer syntax.
const data = await vault['yourKey'];

// Dot notation.
const data = await vault.yourKey;
```

### Removing Values

Remove data using the `removeItem` method:

```javascript
// Remove the value using the remove method.
vault.removeItem('yourKey');

// Indexer syntax.
delete vault['yourKey'];

// Dot notation.
delete vault.yourKey;
```

### Clearing All Data

Clear all data from the store:

```javascript
await vault.clear();
```

### Getting Store Length

Get the count of entries in the store:

```javascript
const count = await vault.length();
console.log(count);
```

## API Reference

- `setItem(key: string, value: any)`: Store data in the database.
- `getItem(key: string)`: Retrieve data from the database.
- `removeItem(key: string)`: Remove data from the database.
- `clear()`: Clear all data from the database.
- `length()`: Get the count of entries in the database.

## Comparing `vault` with LocalStorage

| Feature                  | `vault` (IndexedDB)      | LocalStorage           |
|--------------------------|--------------------------|------------------------|
| **API Complexity**       | Simple, intuitive API    | Simple, intuitive API  |
| **Capacity**             | Large (up to browser limit, often no less than 250MB) | Limited (5MB typical)  |
| **Data Types**           | Supports structured data, including objects and arrays | Only stores strings    |
| **Performance**          | Asynchronous, non-blocking | Synchronous, can block UI |
| **Transaction Support**  | Complete transaction support for reliable data operations | None                  |

## Vault Roadmap

Since the vault is baesd on IndexDB database as storage provider, it is possible
to make it more powerful and useful. Here are some planned features and their
implementation status.

### Core Features

- [x] Extensible Vault class that has following qualities
  - Provides a simple interface similar to local and session storages
  - Supports indexers and dot notation for intuitive and ergonomic access
  - Store large amount of data
  - Perorm transactional in non-blocking asynchronous manner
- [x] Global default vault instance for ease of use
- [x] Support custom databases

### Advanced Features - Middleware and Encryption

- [x] Middleware support
- [x] Support encrypted values to safeguard sensitive data in the vault

### Other Advanced Features

- [ ] Support multiple update in a single transaction
- [ ] Automatic expiration of values based on TTL, Session Timeout and other
      expiration policies
- [ ] Support for vault data backup and restore

## Contributing

Contributions to `vault-storage` are welcome. Please ensure that your code adheres to the existing style and includes tests covering new features or bug fixes.

## License

`vault-storage` is [MIT licensed](./LICENSE).
