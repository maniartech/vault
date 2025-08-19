
const proxyHandler = {
  get(target: any, key: string) {
    // If it's an existing property or method, return it (bind methods to target)
    if (key in target) {
      return typeof (target as any)[key] === 'function'
        ? (target as any)[key].bind(target)
        : (target as any)[key];
    }
    // Otherwise, delegate to storage get
    return (target as any).getItem(key);
  },
  set(target: any, key: string, value: any) {
    // If property exists on instance, set it directly (do not persist)
    if (key in target) {
      (target as any)[key] = value;
      return true;
    }
    // Do not persist functions (e.g., Jasmine spies); set on instance to avoid DataCloneError
    if (typeof value === 'function') {
      (target as any)[key] = value;
      return true;
    }
    // Otherwise persist as an item
    return (target as any).setItem(key, value);
  },
  deleteProperty(target: any, key: string) {
    // If property exists on instance, delete it directly
    if (key in target) {
      // Deleting class properties like methods is not typical, but honor the contract
      delete (target as any)[key];
      return true;
    }
    // Otherwise remove from storage
    return (target as any).removeItem(key);
  }
}

export default proxyHandler
