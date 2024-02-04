// Importing required modules
const esbuild   = require('esbuild'); // For bundling and minifying JavaScript
const fs        = require('fs'); // For file system operations
const path      = require('path'); // For handling and transforming file paths
const { exec }  = require('child_process'); // For running shell commands

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

// Get all TypeScript files in the 'src' directory
const entryPoints = getEntryPoints('src');

// Prepare build options for each TypeScript file
const buildOptions = entryPoints.map(entryPoint => {
  // Get the file name without extension
  const fileName = path.basename(entryPoint, path.extname(entryPoint));
  // Return the build options
  return {
    entryPoints: [entryPoint],
    bundle: true,
    minify: !debug,
    format: 'esm',
    sourcemap: debug,
    outfile: `dist/${fileName}.js`,
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
    Promise.all(buildOptions.map(options => esbuild.build(options)))
      .then(runTSC)
      .catch(() => process.exit(1));
  });
}