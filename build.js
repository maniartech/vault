const { clear } = require('console');
const esbuild = require('esbuild');

const isWatch = process.argv.includes("--watch");

// Clear dist and typings folders
const fs = require('fs');
const path = require('path');

function cleanDir(dir) {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    fs.rmdirSync(dirPath, { recursive: true });
  }
  ensureDir(dirPath);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Function to get all entry points (TypeScript files in this case) in a directory
function getEntryPoints(dir) {
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.ts'))  // Adjust this if you have .tsx or .jsx files
    .map(file => path.join(dir, file));
}

const entryPoints = getEntryPoints('src');  // Replace 'src' with your source directory

cleanDir('./dist');
cleanDir('./typings');

// Build each entry point separately
entryPoints.forEach(async (entryPoint) => {
  const fileName = path.basename(entryPoint, path.extname(entryPoint));
   const buildOptions = {
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    format: 'esm',
    sourcemap: true,
    outfile: `dist/${fileName}.js`,  // Output each file separately
  };

  if (isWatch) {
    buildOptions.watch = {
      onRebuild(error, result) {
        if (error) console.error('Watch build failed:', error);
        else console.log('Watch build succeeded:', result);
      },
    };
  }

  esbuild.build(buildOptions).catch(() => process.exit(1));
});

// if (isWatch) {
//   buildOptions.watch = {
//     onRebuild(error, result) {
//       if (error) console.error('Watch build failed:', error);
//       else console.log('Watch build succeeded:', result);
//     },
//   };
// }

// esbuild.build(buildOptions).catch(() => process.exit(1));
