# vault

`vault` is a sophisticated browser-based storage library that leverages the power
of IndexedDB, offering significant improvements over traditional LocalStorage.
As a high-performance, asynchronous solution for client-side storage, `vault`
provides an intuitive and easy-to-use API to interact with IndexedDB, making
client-side data storage efficient and scalable.

## Features

- **Similar API**: Easy to use, similar to LocalStorage.
- **Lightweight**: No dependencies, small footprint (~800 bytes minified, ~400 bytes gzipped).
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
| **Query Capabilities**   | Complex querying and indexing | Only key-based access   |
| **Data Integrity**       | Robust with versioning and error handling | Prone to data conflicts |

## Contributing

Contributions to `vault-storage` are welcome. Please ensure that your code adheres to the existing style and includes tests covering new features or bug fixes.

## License

`vault-storage` is [MIT licensed](./LICENSE).
