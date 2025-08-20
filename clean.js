import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function cleanUp() {
  try {
    // Directories to remove
    await Promise.all([
      fs.rm(path.join(__dirname, 'dist'), { recursive: true, force: true }),
      fs.rm(path.join(__dirname, 'types'), { recursive: true, force: true }),
      fs.rm(path.join(__dirname, '.temp'), { recursive: true, force: true }),
      fs.rm(path.join(__dirname, 'coverage'), { recursive: true, force: true })
    ]);
    console.log('Removed dist, types, .temp, and coverage directories.');

    // Remove all generated build files in root
    const files = await fs.readdir(__dirname);
    
    // Define patterns for files to remove in root
    const rootFilesToRemove = files.filter(file => 
      file.endsWith('.js') && !['build.js', 'clean.js', 'debug-encryption.js'].includes(file) ||
      file.endsWith('.d.ts') ||
      file.endsWith('.js.map') ||
      file.endsWith('.js.gz') ||
      file.endsWith('.tgz')
    );

    if (rootFilesToRemove.length > 0) {
      await Promise.all(rootFilesToRemove.map(file => fs.unlink(path.join(__dirname, file))));
      console.log(`Removed ${rootFilesToRemove.length} generated file(s) from root: ${rootFilesToRemove.join(', ')}`);
    }

    // Clean generated files in middlewares directory
    const middlewaresDir = path.join(__dirname, 'middlewares');
    try {
      const middlewareFiles = await fs.readdir(middlewaresDir);
      const middlewareFilesToRemove = middlewareFiles.filter(file => 
        file.endsWith('.js') ||
        file.endsWith('.d.ts') ||
        file.endsWith('.js.map') ||
        file.endsWith('.js.gz')
      );

      if (middlewareFilesToRemove.length > 0) {
        await Promise.all(middlewareFilesToRemove.map(file => fs.unlink(path.join(middlewaresDir, file))));
        console.log(`Removed ${middlewareFilesToRemove.length} generated file(s) from middlewares: ${middlewareFilesToRemove.join(', ')}`);
      }

      // Also clean the nested middlewares and types directories
      await Promise.all([
        fs.rm(path.join(middlewaresDir, 'middlewares'), { recursive: true, force: true }),
        fs.rm(path.join(middlewaresDir, 'types'), { recursive: true, force: true })
      ]);
      console.log('Removed nested middlewares/middlewares and middlewares/types directories.');
    } catch (err) {
      // middlewares directory might not exist, that's okay
    }

    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

cleanUp();
