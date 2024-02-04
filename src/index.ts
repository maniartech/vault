import Vault from './vault';

/**
 * The default vault storage instance that provides a convenient way to use the
 * Vault without having to instantiate it manually. This instance is created
 * by default when the module is imported.
 *
 * @type {Vault}
 */
const vault = new Vault();

export default vault;
