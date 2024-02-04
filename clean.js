const fs = require('fs/promises');
const path = require('path');
const glob = require('glob');
const util = require('util');

// Promisify the glob function for pattern matching
const globPromise = util.promisify(glob);

async function cleanUp() {
  try {
    // Directories to remove
    await Promise.all([
      fs.rm(path.join(__dirname, 'dist'), { recursive: true, force: true }),
      fs.rm(path.join(__dirname, 'types'), { recursive: true, force: true })
    ]);
    console.log('Removed dist and types directories.');

    // Remove .tgz files using glob pattern
    const tgzFiles = await globPromise('*.tgz', { cwd: __dirname });
    await Promise.all(tgzFiles.map(file => fs.unlink(path.join(__dirname, file))));
    console.log('Removed .tgz files.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

cleanUp();
