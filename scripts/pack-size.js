#!/usr/bin/env node

/**
 * Pack Size Script
 * Shows the size of the package tarball and extracted contents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getDirectorySize(dirPath) {
  let totalSize = 0;

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  }

  if (fs.existsSync(dirPath)) {
    walkDir(dirPath);
  }

  return totalSize;
}

log('\n📦 Package Size Information', 'cyan');
log('═'.repeat(70), 'blue');

// Check for tarball
const tarballs = fs.readdirSync(rootDir).filter(f => f.match(/^vault-storage-.*\.tgz$/));

if (tarballs.length === 0) {
  log('\n⚠️  No tarball found. Creating package...', 'yellow');
  try {
    execSync('yarn pack', { cwd: rootDir, stdio: 'inherit' });
    const newTarballs = fs.readdirSync(rootDir).filter(f => f.match(/^vault-storage-.*\.tgz$/));
    if (newTarballs.length > 0) {
      tarballs.push(newTarballs[0]);
    }
  } catch (error) {
    log('✗ Failed to create tarball', 'yellow');
    process.exit(1);
  }
}

if (tarballs.length > 0) {
  log('\n📦 Compressed (Tarball):', 'green');
  tarballs.forEach(tarball => {
    const tarballPath = path.join(rootDir, tarball);
    const stat = fs.statSync(tarballPath);
    const size = formatBytes(stat.size);
    log(`  ${tarball}: ${size}`, 'cyan');
  });
}

// Check for extracted package
const extractedDir = path.join(rootDir, '.temp', 'package-preview', 'package');

if (fs.existsSync(extractedDir)) {
  const size = getDirectorySize(extractedDir);
  log('\n📂 Extracted (Uncompressed):', 'green');
  log(`  ${formatBytes(size)}`, 'cyan');

  // Get file count
  let fileCount = 0;
  function countFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        countFiles(fullPath);
      } else {
        fileCount++;
      }
    }
  }
  countFiles(extractedDir);
  log(`  ${fileCount} files`, 'cyan');
} else {
  log('\n💡 Run `yarn pack:preview` to see extracted size', 'yellow');
}

// Size recommendations
log('\n📊 Size Guidelines:', 'blue');
log('  Excellent: < 50 KB compressed', 'green');
log('  Good: 50-100 KB compressed', 'green');
log('  Acceptable: 100-200 KB compressed', 'yellow');
log('  Large: > 200 KB compressed', 'yellow');

const tarballSize = tarballs.length > 0 ? fs.statSync(path.join(rootDir, tarballs[0])).size : 0;
const sizeKB = Math.round(tarballSize / 1024);

log('\n✓ Current Status:', 'cyan');
if (sizeKB < 50) {
  log(`  ${sizeKB} KB - Excellent! 🎉`, 'green');
} else if (sizeKB < 100) {
  log(`  ${sizeKB} KB - Good ✓`, 'green');
} else if (sizeKB < 200) {
  log(`  ${sizeKB} KB - Acceptable`, 'yellow');
} else {
  log(`  ${sizeKB} KB - Consider optimization`, 'yellow');
}

log('');
