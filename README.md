# Vault Storage

Vault Storage is a sophisticated browser-based storage library that leverages the power
of IndexedDB, offering significant improvements over traditional LocalStorage.
As a high-performance, asynchronous solution for client-side storage, it
provides an intuitive and easy-to-use API similar to local and session storage,
increasing the capacity of the storage, and adding support for structured data,
and support for multiple stores. It also provides a secure storage for sensitive
data.

## Features

- **Similar API**: Easy to use, similar to LocalStorage.
- **Lightweight**: No dependencies, micro footprint
  - Less than a KB (minified and gzipped), unsecured vault
  - Around a KB (minified and gzipped), secured vault
- **Multiple Stores Support**: Supports multiple stores with single api.
- **Store Additional Meta Data**: Store additional meta data along with the item value.
- **Encrypted Vault**: Provides a secure storage for sensitive data.
- **Backup and Restore**: Export and import the vault storage data.
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

First, import the `vault` from `vault-storage`. The `vault` is a default instance
of the `Vault` storage class and hence does not need any special initialization
or setup!!! The `vault` provides a ready to use instance similar to localStorage
and sessionStorage. You can start using it right away without any setup.

```javascript
import vault from 'vault-storage';
```

### Initializing and Setup

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

You can also create a custom storage. This is useful when you want to use
multiple storages for different purposes. All the custom storage also share the
same API as the default vault storage and other built-in storages like
localStorage and sessionStorage.

```javascript
import Vault from 'vault-storage/vault';


const appStorage = new Vault("app-storage")
appStorage.setItem("key", "value")
console.log("key", await appStorage.getItem("key"))

const userStorage = new Vault("user-storage")
userStorage.setItem("key", "value")
```

### Secured Storage

Secured storages are useful when you want to store sensitive data. It shares
the same API but it encrypts the data before storing it in the
storage. It uses browser's native crypto API to encrypt the data. The secured
storage can be created using a fixed credentials or dynamic credentials (credentials
that are generated based on the key).

```javascript
import SecuredVault from 'vault-storage/secured-vault';

// Secured storage using fixed credentials (password and salt).
const authStorage = new SecuredVault("secured-storage", {
  password: "SADF@#$W$ERWESD",
  salt: "SDF@#$%SERWESD",
});

authStorage.token = "my-token"
console.log("token", await authStorage.token)

// Secured storage using dynamic credentials.
const securedStorage = new SecuredVault("secured-storage", (key) => {
  const password = key === "token" ? "ASF@#$%QER()SDF" : "SXDFW#$%@#SDF";
  const salt = key.startsWith("key1") ? "xxx@xxxxxxxxxx" : "yyy@yyyyyyyyyy";
  return { password, salt };
});

// Secured storage using promise based dynamic credentials.
const sensitiveStorage = new SecuredVault("secured-storage", async (key) => {
  return new Promise(async (resolve) => {
    const { password, salt } = await fetchOrGenerateCredentialsFor(key)
    resolve({ password, salt })
  });
});


// Once the secured vault is setup, usage is similar to the regular vault
// storage. Just start using it!

// Set the values. It stores the encrypted Uint8Array in the storage
// against the key. If you want to immediately use the value, then
// you must use await while setting the value.
await authStorage.setItem("token", "eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTcwNzA2NzgwMywiaWF0IjoxNzA3MDY3ODAzfQ.XmPqTUN3KJeEArX58xVfHIQGGtm291p9ZamBvrflCMo")

// Get the values. Remember to use await! As it's asynchronous.
const token = await authStorage.token; // Decrypts the token from the authStorage
                                       // and returns the original token.
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

### Working with Item Meta Data

You can also store meta data along with the item value. The meta data is useful
when you want to store some additional information about the item. The meta data
is stored along with the item value and can be retrieved using the `getItemMeta` method.

```javascript
// Set the additional meta data along with the item value.
vault.setItem('yourKey', { any: 'data' }, {
  roles: ['editor', 'moderator'],
});

// Get the meta data for the specified item.
const meta = await vault.getItemMeta('yourKey');
console.log(`yourKey is marked for '${meta.roles}' roles! `);

if (user.roles.some(role => meta.roles.includes(role))) {
  // User has access to the specified item in the vault.
}
```

### Backup and Restore Vault Storage

With version 1.3 and above, you can export and import the vault storage data. Please note that while exporting the secured storage data, the data is exported in non-encrypted form. You must be careful while exporting the data and ensure that the data is exported in a secure manner.

> We are still considering the best way to export the secured storage data in an encrypted form. If you have any suggestions, please let us know.

```javascript
import { importData, exportData } from 'vault-storage/backup';

const data = await exportData(vault);

// You can now save the data to a file or send it to the server.
// For example, you can save the data to a file using the following code.
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url
a.download = 'vault-data.json';
a.click();

// To import the data back to the vault, you can use the following code.
const importedData = await importData(data);
```

## API Reference

### `Vault` Class

The `Vault` class is the cornerstone of our storage capabilities, providing a functionality akin to `localStorage` and `sessionStorage`. It empowers you to establish custom storage instances, offering a intuitive and user-friendly API for data storage and retrieval. Here's a rundown of the methods available in the `Vault` class:

```javascript
import Vault from 'vault-storage/vault';
```

- `setItem(key: string, value: any, meta: any)`: Store data in the storage.
- `getItem(key: string)`: Retrieve data from the storage.
- `removeItem(key: string)`: Remove data from the storage.
- `clear()`: Clear all data from the storage.
- `length()`: Get the count of entries in the storage.

### `vault` Default Instance

The `vault` is a default instance of the `Vault` class, providing a ready-to-use storage solution without any setup or initialization.

```javascript
import vault from 'vault-storage';
```

### `SecuredVault` Class

The `SecuredVault` class is a provides a secure storage for sensitive data. It encrypts the data before storing it in the storage. It uses browser's native crypto API to encrypt the data. The secured storage can be created using a fixed credentials or dynamic credentials (credentials that are generated based on the key). For more information, refer to the [usage section above](#secured-storage).

### Import and Export Functions

Additionally, the `vault-storage` library offers two functions for exporting and importing vault storage data:

```javascript
import { importData, exportData } from 'vault-storage/backup';
```

- `exportData(vault: Vault)`: Export the vault storage data.
- `importData(data: any)`: Import the vault storage data.

## Comparing Vault with LocalStorage

| Feature                  | Vault      | LocalStorage           |
|--------------------------|--------------------------|------------------------|
| **API Complexity**       | Simple, intuitive API    | Simple, intuitive API  |
| **Capacity**             | Large (up to browser limit, often no less than 250MB) | Limited (5MB typical)  |
| **Multiple Stores**      | Supports multiple stores | Single store           |
| **Meta Data**            | Supports storing meta data along with the item value | No support for meta data |
| **Encrypted Storage**    | Supports built-in secured storage | No built-in encryption support  |
| **Data Types**           | Supports structured data, including objects and arrays | Only stores strings    |
| **Built-in Data Import/Export** | Supports backup and restore of the vault storage | No built-in support for data import/export |
| **Performance**          | Asynchronous, non-blocking | Synchronous, can block UI |

## Vault Roadmap

Since the vault is baesd on IndexDB database as storage provider, it is possible
to make it more powerful and useful. Here are some planned features and their
implementation status.

### Core Features

- [x] Extensible Vault class that has following qualities `(v1.0.*)`
  - Provides a simple interface similar to local and session storages
  - Supports indexers and dot notation for intuitive and ergonomic access
  - Store large amount of data
  - Perorm transactional in non-blocking asynchronous manner
- [x] Global default vault instance for ease of use `(v1.0.*)`
- [x] Support custom databases `(v1.0.*)`

### Advanced Features - Encryption

- [x] Support for secured vault storage `(v1.1.*)`
- [x] Support for dynamic password and salt for secured vault storage `(v1.0.*)`

### Other Advanced Features

- [x] Support for storing and retriving meta data along with item
      values. `(v1.2.*)`
- [x] Support for vault data backup and restore `(v1.3.*)`
- [ ] Automatic expiration of values through `expires` meta data. `(Future)`

## Contributing

Contributions to `vault-storage` are welcome. Please ensure that your code adheres to the existing style and includes tests covering new features or bug fixes.

## License

`vault-storage` is [MIT licensed](./LICENSE).
