// Importing required modules
import esbuild from 'esbuild'; // For bundling and minifying JavaScript
import fs from 'fs'; // For file system operations
import path from 'path'; // For handling and transforming file paths
import { exec } from 'child_process'; // For running shell commands
import { platform } from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const debug = process.argv.includes("--debug") || false;

// Check if the "--watch" argument is passed in the command line
const isWatch = process.argv.includes("--watch");

// Function to run the TypeScript compiler
function runTSC() {
  // Execute the 'yarn tsc' command
  exec('yarn tsc', (error, stdout, stderr) => {
    // If there's an error, log it and return
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    // If there's stderr, log it and return
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    // Log the stdout of the 'yarn tsc' command
    console.log(`TypeScript compilation:\n${stdout}`);
  });
}

// Function to ensure a directory exists
function ensureDir(dirPath) {
  // If the directory doesn't exist, create it
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Function to get all TypeScript files in a directory
function getEntryPoints(dir) {
  // Read the directory, filter out non-TypeScript files, and return their absolute paths
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(dir, file));
}

// Function to get all TypeScript files in a directory recursively
function getEntryPointsRecursive(dir, baseDir = '') {
  const entryPoints = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively get entry points from subdirectories
      entryPoints.push(...getEntryPointsRecursive(fullPath, path.join(baseDir, file)));
    } else if (file.endsWith('.ts')) {
      entryPoints.push({
        source: fullPath,
        output: path.join(baseDir, file.replace('.ts', '.js'))
      });
    }
  }

  return entryPoints;
}

// Get all TypeScript files in the 'src' directory recursively
const allEntryPoints = getEntryPointsRecursive('src');

// Ensure directories exist for output files
allEntryPoints.forEach(entry => {
  const outputDir = path.dirname(entry.output);
  if (outputDir !== '.') {
    ensureDir(outputDir);
  }
});

// Prepare build options for each TypeScript file
const buildOptions = allEntryPoints.map(entry => {
  // Get the file name without extension
  const fileName = path.basename(entry.source, path.extname(entry.source));
  const isIndex = fileName === 'index' && entry.output === 'index.js';
  const isMini = fileName === 'index.mini' && entry.output === 'index.mini.js';

  return {
    entryPoints: [entry.source],
    bundle: isIndex || isMini, // bundle minimal index as well
    minify: !debug,
    format: 'esm',
    sourcemap: debug,
    outfile: `./${entry.output}`,
    platform: 'browser',
    target: 'es2019',
    legalComments: 'none',
    drop: debug ? [] : ['console', 'debugger']
  };
});

// Build all TypeScript files and then run the TypeScript compiler
Promise.all(buildOptions.map(options => esbuild.build(options)))
  .then(() => {
    runTSC();
    // If "--watch" is passed in the command line, log a message
    if (isWatch) {
      console.log('Watching for changes...');
    }
  })
  .catch(() => process.exit(1));

// If "--watch" is passed in the command line, watch the 'src' directory for changes
if (isWatch) {
  fs.watch('src', { recursive: true }, (eventType, filename) => {
    console.log(`File ${filename} was changed, rebuilding...`);
    // Regenerate entry points in case new files were added
    const updatedEntryPoints = getEntryPointsRecursive('src');
    updatedEntryPoints.forEach(entry => {
      const outputDir = path.dirname(entry.output);
      if (outputDir !== '.') {
        ensureDir(outputDir);
      }
    });

    const updatedBuildOptions = updatedEntryPoints.map(entry => {
      const fileName = path.basename(entry.source, path.extname(entry.source));
      const isIndex = fileName === 'index' && entry.output === 'index.js';
      const isMini = fileName === 'index.mini' && entry.output === 'index.mini.js';

      return {
        entryPoints: [entry.source],
        bundle: isIndex || isMini,
        minify: !debug,
        format: 'esm',
        sourcemap: debug,
        outfile: `./${entry.output}`,
        platform: 'browser',
        target: 'es2019',
        legalComments: 'none',
        drop: debug ? [] : ['console', 'debugger']
      };
    });

    Promise.all(updatedBuildOptions.map(options => esbuild.build(options)))
      .then(runTSC)
      .catch(() => process.exit(1));
  });
}