# Why VaultStorage Will Make You Forget LocalStorage?

Imagine this: You're developing a web application, and you need to store some data on the client side. LocalStorage seems like an easy and defacto storage solution, but soon you find yourself wrestling with its limitations. The storage capacity is insufficient, there's no built-in encryption for sensitive data, and handling structured data is a nightmare.

Introducing VaultStorage - the ultimate solution for browser-based storage! This lightweight library, with a **size of less than 1KB (1.5KB with advanced features)**, offers **an API similar to LocalStorage** but with enhanced power and flexibility. Leveraging IndexedDB, VaultStorage provides a high-performance, asynchronous, and secure storage solution that is as easy to use as LocalStorage, but with added capabilities and versatility. Say goodbye to the limitations of LocalStorage and embrace the seamless experience of VaultStorage.

## Why VaultStorage?

As a developer building web applications, we've all been using LocalStorage for years. It's a simple and convenient tool for storing data on the client side. But as we started working on more complex projects, we quickly realized that LocalStorage has its limitations. The 5MB storage cap, the lack of support for structured data, and the absence of encryption for sensitive information and role-based access control were significant pain points. We face these challenges every day, and we knew there had to be a better way. We wanted a storage solution that could handle large amounts of data, support multiple storage units, works with structured data, and provides secure storage for sensitive information. VaultStorage was born out of this need. It's a library designed to address the shortcomings of LocalStorage while providing a simple, LocalStorage-like API. It is built to be lightweight, easy to use, and powerful, making it the perfect solution for modern web applications. It was created by developers, for developers, with the aim of making client-side storage a seamless and powerful experience.

## Getting Started

Let's dive into the basics of VaultStorage, showing you how to install it, import it, and get started with your first storage operations.

### Installation

Installing VaultStorage is straightforward. You can use npm or yarn, depending on your preference:

```bash
npm install vault-storage --save
```

Or, if you prefer yarn:

```bash
yarn add vault-storage
```

With VaultStorage installed, you're ready to start leveraging its powerful features.

### Importing Vault

To begin using VaultStorage in your project, simply import it. The great thing about VaultStorage is that it doesn't require any special initialization. It's ready to use right away!

```javascript
import vault from 'vault-storage';
```

Now, you're all set to start using VaultStorage, which offers an API similar to LocalStorage but with much more flexibility and power.

## Using VaultStorage

Using VaultStorage is very similar to using LocalStorage, but remember that VaultStorage is asynchronous, so you'll need to use `await` or handle Promises.

**Setting Values:** Similar to local storage you can set values directly on the vault object. Or use `setItem` method.

```javascript
// Set the values.
vault.key1 = "value1";
vault.key2 = "value2";
```

**Getting Values:**

Since VaultStorage is asynchronous, you should use `await` or handle Promises when retrieving values.

```javascript
// Using await to get values.
const value1 = await vault.key1; // "value1"
const value2 = await vault.key2; // "value2"

// Using Promises to get values.
vault.key1.then(value1 => console.log(value1)); // "value1"
vault.key2.then(value2 => console.log(value2)); // "value2"
```

### Custom Storage

Imagine you're building a web application with different components requiring separate storage spaces, such as user preferences, application settings, and temporary session data. With VaultStorage, you can create custom storages to keep this data organized.

**Creating Custom Storage:**

Create a file named `storages.js`:

```javascript
// storages.js
import Vault from 'vault-storage/vault';

// Create custom storages for different purposes.
const appStorage = new Vault("app-storage");
const userStorage = new Vault("user-storage");

export { appStorage, userStorage };
```

Now, you can import and use these custom storages in your application:

**Using Custom Storages:**

```javascript
// Import custom storages.
import { appStorage, userStorage } from './storages';

// Using appStorage to store application settings.
await appStorage.setItem("theme", "dark");
console.log(await appStorage.getItem("theme")); // "dark"

// Using userStorage to store user preferences.
await userStorage.setItem("language", "en");
console.log(await userStorage.getItem("language")); // "en"
```

This modular approach keeps your code clean and makes it easier to manage different storage needs.

### Secured Storage

Secured storage is essential for storing sensitive data securely, such as authentication tokens or personal user data. VaultStorage provides a way to create secured storages that encrypt data before storing it.

**Creating Secured Storage:**

Let's create a secured storage for storing sensitive information in the previous example file `storages.js`:

```javascript
// storages.js
import Vault from 'vault-storage/vault';
import SecuredVault from 'vault-storage/secured-vault';

// Create custom storages for different purposes.
const appStorage = new Vault("app-storage");
const userStorage = new Vault("user-storage");

// Create a secured storage with fixed credentials.
const authStorage = new SecuredVault("secured-storage", {
  password: "SADF@#$W$ERWESD",
  salt: "SDF@#$%SERWESD",
});

export { appStorage, userStorage, authStorage };
```

**Using Custom Storages:**

Import and use these storages in your application:

```javascript
// Import storages.
import { appStorage, userStorage, authStorage } from './storages';

// Using authStorage to securely store an authentication token.
await authStorage.setItem("token", "secureToken");
console.log(await authStorage.getItem("token")); // "secureToken"
```

Secured storage ensures that sensitive information is stored safely, protecting it from unauthorized access.

### Working with Item Meta Data

Meta data can be particularly useful in applications requiring additional context for stored items, such as user roles, timestamps, or data tags. For example, you might want to restrict access to certain items based on user roles or mark items with specific attributes. Or you might need to track when an item was last updated or created. Or you might want to categorize items based on tags. The possibilities are endless! VaultStorage allows you to associate meta data with stored items, enabling you to add context and control to your storage operations.

**Setting Meta Data:**

```javascript
await vault.setItem('yourKey', { any: 'data' }, {
  roles: ['editor', 'moderator'],
});
```

**Getting Meta Data:**

```javascript
const meta = await vault.getItemMeta('yourKey');
console.log(`yourKey is marked for '${meta.roles}' roles!`);

if (user.roles.some(role => meta.roles.includes(role))) {
  // User has access to the specified item in the vault.
}
```

## Comparing Vault with LocalStorage

In this section, we'll compare VaultStorage with LocalStorage to highlight the advantages of using VaultStorage for your web applications. We'll provide a feature comparison table and share real-world examples to illustrate its benefits.

### Feature Comparison Table

| Feature                  | VaultStorage         | LocalStorage           |
|--------------------------|-----------------------|------------------------|
| **API Complexity**       | Simple, intuitive API | Simple, intuitive API  |
| **Capacity**             | Large (up to browser limit, often no less than 250MB) | Limited (5MB typical)  |
| **Multiple Stores**      | Supports multiple stores | Single store           |
| **Meta Data**            | Supports storing meta data along with the item value | No support for meta data |
| **Encrypted Storage**    | Supports built-in secured storage | No built-in encryption support  |
| **Data Types**           | Supports structured data, including objects and arrays | Only stores strings    |
| **Performance**          | Asynchronous, non-blocking | Synchronous, can block UI |

### Real-World Examples

Let's explore some real-world scenarios where VaultStorage proves advantageous over LocalStorage.

#### Handling Large Amounts of Data

Imagine you're developing a web-based note-taking application. Users expect to store a significant amount of notes, including text, images, and other media. With LocalStorage's 5MB limit, you'll quickly run into storage issues. VaultStorage, leveraging IndexedDB, allows you to store much larger amounts of data, ensuring your application scales with user needs.

#### Separating Different Types of Data

Consider a multi-user web application where you need to store user preferences, application settings, and temporary session data separately. With LocalStorage, you'd have to manage all data in a single storage space, leading to potential conflicts and complexity. VaultStorage's support for multiple storages allows you to cleanly separate different types of data:

```javascript
// Import custom storages.
import { appStorage, userStorage } from './storages';

// Store application settings.
await appStorage.setItem("theme", "dark");
console.log(await appStorage.getItem("theme")); // "dark"

// Store user preferences.
await userStorage.setItem("language", "en");
console.log(await userStorage.getItem("language")); // "en"
```

#### Securely Storing Sensitive Information

In a web application handling user authentication, you need to securely store tokens and sensitive data. LocalStorage does not offer built-in encryption, making it unsuitable for such use cases. VaultStorage provides secured storage, ensuring data is encrypted and protected:

```javascript
// Import secured storage.
import { authStorage } from './storages';

// Securely store an authentication token.
await authStorage.setItem("token", "secureToken");
console.log(await authStorage.getItem("token")); // "secureToken"
```

#### Storing Structured Data

If your application needs to store complex data structures like objects and arrays, LocalStorage's string-only limitation becomes a hurdle. VaultStorage supports structured data, making it easier to work with complex data:

```javascript
// Store structured data.
await vault.setItem('userProfile', { name: 'John Doe', age: 30, roles: ['admin', 'user'] });

// Retrieve structured data.
const userProfile = await vault.getItem('userProfile');
console.log(userProfile); // { name: 'John Doe', age: 30, roles: ['admin', 'user'] }
```

#### Adding Meta Data for Better Data Management

Meta data can provide additional context for stored items, which is useful for managing access control, adding timestamps, or categorizing data. LocalStorage does not support meta data, but VaultStorage does:

```javascript
// Store item with meta data.
await vault.setItem('document', { title: 'Project Plan', content: '...' }, { created: '2024-05-14', tags: ['project', 'plan'] });

// Retrieve item and meta data.
const documentMeta = await vault.getItemMeta('document');
console.log(`Document created on ${documentMeta.created} with tags: ${documentMeta.tags.join(', ')}`);
```

VaultStorage offers significant advantages over LocalStorage, making it a superior choice for modern web applications. Whether you need to handle large amounts of data, manage different types of storage, secure sensitive information, or work with complex data structures, VaultStorage provides a robust and flexible solution.

## Final Thoughts: Why VaultStorage is the Superior Choice?

**Why VaultStorage is the superior choice?** or the title question, **Why VaultStorage Will Make You Forget LocalStorage?** Let's summarize the key benefits of Vault-Storage:

- **Increased Capacity**: Store significantly larger amounts of data, ensuring scalability for applications with extensive data needs.
- **Multiple Storage Options**: Create and manage multiple storages for different data types, reducing complexity and enhancing data organization.
- **Secure Storage**: Protect sensitive information with built-in encryption, leveraging the browser's native crypto API.
- **Structured Data Handling**: Easily store and retrieve complex data structures like objects and arrays, improving data management and manipulation.
- **Enhanced Performance**: Enjoy non-blocking, asynchronous operations, ensuring smooth and responsive user experiences.
- **Meta Data Support**: Attach additional meta data to stored items, providing valuable context and improving data management.
- **Micro < 1KB Library**: Keep your application lightweight and fast with a small library footprint.
- **Minimal Learning Curve**: Transition seamlessly from LocalStorage to Vault-Storage with a familiar and intuitive API.

With these advantages, I am confident that VaultStorage will become your go-to storage solution for modern web applications. And I'm sure, once you make a switch to VaultStorage, you'll forget all about LocalStorage! Are you ready to level up your client-side storage game? Give VaultStorage a try today and experience the difference for yourself.

Happy coding!
