#!/usr/bin/env node

/**
 * Pack Inspect Script
 * Inspects the contents of the package tarball
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// First, create the package preview
log('\n📦 Creating package preview...', 'cyan');
try {
  execSync('yarn pack:preview', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  log('✗ Failed to create package preview', 'yellow');
  process.exit(1);
}

// Get all files in the package
const packageDir = path.join(rootDir, '.temp', 'package-preview', 'package');

if (!fs.existsSync(packageDir)) {
  log('✗ Package directory not found. Run yarn pack:preview first.', 'yellow');
  process.exit(1);
}

log('\n📋 Package Contents:', 'blue');
log('═'.repeat(70), 'blue');

// Recursively get all files
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath);
      files.push('./' + relativePath.replace(/\\/g, '/'));
    }
  }

  return files;
}

const files = getAllFiles(packageDir).sort();

// Group files by directory
const filesByType = {
  dist: [],
  root: [],
  scripts: [],
  other: [],
};

files.forEach(file => {
  if (file.startsWith('./dist/')) {
    filesByType.dist.push(file);
  } else if (file.match(/^\.\/(package\.json|README\.md|LICENSE)$/)) {
    filesByType.root.push(file);
  } else if (file.startsWith('./scripts/')) {
    filesByType.scripts.push(file);
  } else {
    filesByType.other.push(file);
  }
});

// Display by type
if (filesByType.root.length > 0) {
  log('\n📄 Root Files:', 'green');
  filesByType.root.forEach(file => log(`  ${file}`));
}

if (filesByType.dist.length > 0) {
  log('\n📦 Distribution Files (dist/):', 'green');
  filesByType.dist.forEach(file => log(`  ${file}`));
}

if (filesByType.scripts.length > 0) {
  log('\n🔧 Scripts:', 'green');
  filesByType.scripts.forEach(file => log(`  ${file}`));
}

if (filesByType.other.length > 0) {
  log('\n📁 Other Files:', 'green');
  filesByType.other.forEach(file => log(`  ${file}`));
}

log('\n' + '═'.repeat(70), 'blue');
log(`Total Files: ${files.length}`, 'cyan');

// File type breakdown
const jsFiles = files.filter(f => f.endsWith('.js')).length;
const dtsFiles = files.filter(f => f.endsWith('.d.ts')).length;
const otherFiles = files.length - jsFiles - dtsFiles;

log(`  JavaScript: ${jsFiles}`, 'cyan');
log(`  TypeScript Definitions: ${dtsFiles}`, 'cyan');
log(`  Other: ${otherFiles}`, 'cyan');

log('');
