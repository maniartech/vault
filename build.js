const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const isWatch = process.argv.includes("--watch");

function runTSC() {
  exec('yarn tsc', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log(`TypeScript compilation:\n${stdout}`);
  });
}

function cleanDir(dir) {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  ensureDir(dirPath);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getEntryPoints(dir) {
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(dir, file));
}

const entryPoints = getEntryPoints('src');

cleanDir('./dist');
cleanDir('./typings');

const buildOptions = entryPoints.map(entryPoint => {
  const fileName = path.basename(entryPoint, path.extname(entryPoint));
  return {
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    format: 'esm',
    sourcemap: true,
    outfile: `dist/${fileName}.js`,
  };
});

Promise.all(buildOptions.map(options => esbuild.build(options)))
  .then(() => {
    runTSC();
    if (isWatch) {
      console.log('Watching for changes...');
    }
  })
  .catch(() => process.exit(1));

if (isWatch) {
  fs.watch('src', { recursive: true }, (eventType, filename) => {
    console.log(`File ${filename} was changed, rebuilding...`);
    Promise.all(buildOptions.map(options => esbuild.build(options)))
      .then(runTSC)
      .catch(() => process.exit(1));
  });
}
