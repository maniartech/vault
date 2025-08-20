#!/usr/bin/env node
/*
 Gzip and measure final sizes for distributed JS files.
 - Discovers files from package.json "files" list
 - Recursively scans directories ending with '/'
 - Compresses .js files (skips .map, .d.ts)
 - Writes .gz next to originals and prints a report
 - Optional --check to enforce thresholds via env or defaults
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import esbuild from 'esbuild';

const root = process.cwd();
const args = process.argv.slice(2);
const doCheck = args.includes('--check');
const doBundle = args.includes('--bundle');
const entriesArg = (args.find(a => a.startsWith('--entries=')) || '').split('=')[1];

// Default thresholds in bytes (gzip). Override via env vars if desired.
const thresholds = {
  'vault.js': Number(process.env.SIZE_LIMIT_VAULT || 1024),           // < 1KB gz
  'encrypted-vault.js': Number(process.env.SIZE_LIMIT_ENC || 1536),   // ~1.5KB gz
  'index.js': Number(process.env.SIZE_LIMIT_INDEX || 8192)            // generous (test harness)
};

async function readJSON(file) {
  const content = await fsp.readFile(file, 'utf8');
  return JSON.parse(content);
}

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function collectJsFilesFromFilesList(filesList) {
  const result = new Set();
  for (const entry of filesList) {
    const abs = path.resolve(root, entry);
    const isDir = entry.endsWith('/') || (await exists(abs) && (await fsp.stat(abs)).isDirectory());
    if (isDir) {
      await walk(abs, (p) => {
        if (p.endsWith('.js') && !p.endsWith('.map.js') && !p.endsWith('.d.ts')) {
          result.add(p);
        }
      });
    } else {
      if (abs.endsWith('.js')) result.add(abs);
    }
  }
  return Array.from(result);
}

async function walk(dir, onFile) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // skip node_modules, tests, coverage
      const base = ent.name.toLowerCase();
      if (base === 'node_modules' || base === 'tests' || base === 'coverage') continue;
      await walk(p, onFile);
    } else {
      onFile(p);
    }
  }
}

function gzipBuffer(buf) {
  return new Promise((resolve, reject) => {
    zlib.gzip(buf, { level: zlib.constants.Z_BEST_COMPRESSION }, (err, out) => {
      if (err) return reject(err);
      resolve(out);
    });
  });
}

function pretty(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

(async () => {
  const pkgPath = path.join(root, 'package.json');
  const pkg = await readJSON(pkgPath);
  if (!doBundle) {
    // File-based gzip measurement (no bundling)
    const filesList = pkg.files || [];

    if (!filesList || filesList.length === 0) {
      console.error('No "files" field found in package.json or it is empty.');
      process.exitCode = 1;
      return;
    }

    const jsFiles = await collectJsFilesFromFilesList(filesList);
    if (jsFiles.length === 0) {
      console.warn('No JS files found to process.');
      return;
    }

    let totalOriginal = 0;
    let totalGzip = 0;
    const rows = [];
    const failures = [];

    for (const abs of jsFiles) {
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const content = await fsp.readFile(abs);
      const gz = await gzipBuffer(content);
      const outPath = abs + '.gz';
      await fsp.writeFile(outPath, gz);

      const origSize = content.length;
      const gzSize = gz.length;
      totalOriginal += origSize;
      totalGzip += gzSize;

      const limit = thresholds[path.basename(abs)];
      const ok = typeof limit === 'number' ? gzSize <= limit : true;
      if (doCheck && !ok) {
        failures.push({ file: rel, size: gzSize, limit });
      }

      rows.push({
        file: rel,
        original: origSize,
        gzip: gzSize,
        saved: origSize - gzSize,
        ratio: ((1 - gzSize / origSize) * 100)
      });
    }

    // Print report
    console.log('\nGzip size report (per-file)');
    console.log('='.repeat(60));
    for (const r of rows.sort((a,b) => a.file.localeCompare(b.file))) {
      console.log(`${r.file.padEnd(36)}  orig: ${pretty(r.original).padStart(8)}  gz: ${pretty(r.gzip).padStart(8)}  saved: ${pretty(r.saved).padStart(8)}  (${r.ratio.toFixed(1)}%)`);
    }
    console.log('-'.repeat(60));
    console.log(`TOTAL`.padEnd(36),`  orig: ${pretty(totalOriginal).padStart(8)}  gz: ${pretty(totalGzip).padStart(8)}  saved: ${pretty(totalOriginal-totalGzip).padStart(8)}  (${((1-totalGzip/totalOriginal)*100).toFixed(1)}%)`);

    if (doCheck && failures.length) {
      console.error('\nSize check failures:');
      for (const f of failures) {
        console.error(` - ${f.file}: ${f.size} B > limit ${f.limit} B`);
      }
      process.exitCode = 1;
    }
    return;
  }

  // Bundle-based gzip measurement (includes imports)
  const defaultEntries = ['dist/index.js', 'dist/vault.js', 'dist/encrypted-vault.js'];
  const candidates = entriesArg ? entriesArg.split(',') : defaultEntries;
  const entryFiles = [];
  for (const rel of candidates) {
    const abs = path.resolve(root, rel.trim());
    if (await exists(abs)) entryFiles.push(abs);
  }
  if (entryFiles.length === 0) {
    console.error('No valid entry files found for bundling.');
    process.exitCode = 1;
    return;
  }

  let totalOriginal = 0;
  let totalGzip = 0;
  const rows = [];
  const failures = [];

  for (const abs of entryFiles) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const result = await esbuild.build({
      entryPoints: [abs],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2019',
      legalComments: 'none',
      write: false,
      sourcemap: false,
      drop: ['console','debugger']
    });
    const out = result.outputFiles?.[0]?.contents || Buffer.from('');
    const gz = await gzipBuffer(out);

    const origSize = out.length;
    const gzSize = gz.length;
    totalOriginal += origSize;
    totalGzip += gzSize;

    const limit = thresholds[path.basename(abs)];
    const ok = typeof limit === 'number' ? gzSize <= limit : true;
    if (doCheck && !ok) {
      failures.push({ file: rel, size: gzSize, limit });
    }

    rows.push({
      file: rel + ' (bundled)',
      original: origSize,
      gzip: gzSize,
      saved: origSize - gzSize,
      ratio: ((1 - gzSize / origSize) * 100)
    });
  }

  console.log('\nGzip size report (bundled entries)');
  console.log('='.repeat(60));
  for (const r of rows.sort((a,b) => a.file.localeCompare(b.file))) {
    console.log(`${r.file.padEnd(36)}  orig: ${pretty(r.original).padStart(8)}  gz: ${pretty(r.gzip).padStart(8)}  saved: ${pretty(r.saved).padStart(8)}  (${r.ratio.toFixed(1)}%)`);
  }
  console.log('-'.repeat(60));
  console.log(`TOTAL`.padEnd(36),`  orig: ${pretty(totalOriginal).padStart(8)}  gz: ${pretty(totalGzip).padStart(8)}  saved: ${pretty(totalOriginal-totalGzip).padStart(8)}  (${((1-totalGzip/totalOriginal)*100).toFixed(1)}%)`);

  if (doCheck && failures.length) {
    console.error('\nSize check failures:');
    for (const f of failures) {
      console.error(` - ${f.file}: ${f.size} B > limit ${f.limit} B`);
    }
    process.exitCode = 1;
  }
})();
