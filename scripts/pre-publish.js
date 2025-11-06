#!/usr/bin/env node

/**
 * Pre-publish validation script
 * Validates the package is ready for publishing to npm
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const { red, green, yellow, blue, cyan, reset, gray } = colors;

let errors = [];
let warnings = [];
let passed = [];

function log(message, color = reset) {
  console.log(`${color}${message}${reset}`);
}

function checkmark() {
  return `${green}✓${reset}`;
}

function crossmark() {
  return `${red}✗${reset}`;
}

function warningmark() {
  return `${yellow}⚠${reset}`;
}

// Validation checks
async function validatePackageJson() {
  log(`\n${cyan}📋 Validating package.json...${reset}`);

  try {
    const packagePath = join(rootDir, 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

    // Check required fields
    const requiredFields = ['name', 'version', 'main', 'types', 'exports', 'license'];
    for (const field of requiredFields) {
      if (packageJson[field]) {
        passed.push(`package.json has "${field}" field`);
      } else {
        errors.push(`package.json missing "${field}" field`);
      }
    }

    // Check files field
    if (packageJson.files) {
      if (packageJson.files.some(f => f.startsWith('./'))) {
        warnings.push('files field contains paths starting with "./" - should be relative without leading "./"');
      } else {
        passed.push('package.json "files" field is correctly formatted');
      }
    } else {
      warnings.push('package.json missing "files" field - all files will be published');
    }

    // Check version format
    const version = packageJson.version;
    if (version.includes('alpha') || version.includes('beta')) {
      warnings.push(`Version is pre-release: ${version}`);
    }

    // Validate exports
    if (packageJson.exports) {
      for (const [key, value] of Object.entries(packageJson.exports)) {
        if (value.types) {
          const typesPath = join(rootDir, value.types.replace('./', ''));
          if (existsSync(typesPath)) {
            passed.push(`Export "${key}" types file exists`);
          } else {
            errors.push(`Export "${key}" types file missing: ${value.types}`);
          }
        }
      }
    }

    log(`  ${checkmark()} package.json is valid JSON`);

  } catch (error) {
    errors.push(`package.json parsing error: ${error.message}`);
    log(`  ${crossmark()} package.json has errors`);
  }
}

async function validateBuildFiles() {
  log(`\n${cyan}🔨 Validating build files...${reset}`);

  const distDir = join(rootDir, 'dist');

  if (!existsSync(distDir)) {
    errors.push('dist/ directory does not exist - run "yarn build" first');
    return;
  }

  const expectedFiles = [
    'dist/index.mini.js',
    'dist/index.mini.d.ts',
    'dist/vault.js',
    'dist/vault.d.ts',
    'dist/encrypted-vault.js',
    'dist/encrypted-vault.d.ts',
    'dist/backup.js',
    'dist/backup.d.ts',
    'dist/middlewares/index.js',
    'dist/middlewares/index.d.ts',
    'dist/middlewares/validation.js',
    'dist/middlewares/validation.d.ts',
    'dist/middlewares/expiration.js',
    'dist/middlewares/expiration.d.ts',
    'dist/middlewares/encryption.js',
    'dist/middlewares/encryption.d.ts',
  ];

  for (const file of expectedFiles) {
    const filePath = join(rootDir, file);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      if (stats.size === 0) {
        errors.push(`${file} is empty`);
      } else {
        passed.push(`${file} exists (${(stats.size / 1024).toFixed(2)} KB)`);
      }
    } else {
      errors.push(`Missing required file: ${file}`);
    }
  }
}

async function validateTests() {
  log(`\n${cyan}🧪 Validating tests...${reset}`);

  try {
    // Check for disabled/backup test files
    const testsDir = join(rootDir, 'tests');
    if (existsSync(testsDir)) {
      const fs = await import('fs');
      const files = fs.readdirSync(testsDir);
      const problematicFiles = files.filter(f =>
        f.endsWith('.bak') ||
        f.endsWith('.disabled') ||
        f.endsWith('.skip')
      );

      if (problematicFiles.length > 0) {
        warnings.push(`Found ${problematicFiles.length} disabled/backup test files: ${problematicFiles.join(', ')}`);
      } else {
        passed.push('No disabled/backup test files found');
      }
    }

    // Try to run tests
    log(`  ${gray}Running tests...${reset}`);
    try {
      // Use inherited stdio to avoid maxBuffer overflow on large test output
      execSync('yarn test --no-color', {
        cwd: rootDir,
        stdio: 'inherit',
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 20 // 20MB safety buffer if output is piped elsewhere
      });
      passed.push('All tests passed');
    } catch (error) {
      errors.push('Tests failed - fix before publishing');
    }

  } catch (error) {
    warnings.push(`Could not validate tests: ${error.message}`);
  }
}

async function validateSize() {
  log(`\n${cyan}📦 Validating bundle size...${reset}`);

  try {
    const output = execSync('yarn size:check', {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    passed.push('Bundle size within limits');
    log(`  ${gray}${output.trim()}${reset}`);
  } catch (error) {
    warnings.push('Bundle size check failed or limits exceeded');
  }
}

async function validateDocumentation() {
  log(`\n${cyan}📚 Validating documentation...${reset}`);

  const requiredDocs = [
    { file: 'README.md', required: true },
    { file: 'LICENSE', required: true },
    { file: 'CHANGELOG.md', required: false },
  ];

  for (const doc of requiredDocs) {
    const docPath = join(rootDir, doc.file);
    if (existsSync(docPath)) {
      const stats = statSync(docPath);
      if (stats.size > 0) {
        passed.push(`${doc.file} exists (${(stats.size / 1024).toFixed(2)} KB)`);
      } else {
        (doc.required ? errors : warnings).push(`${doc.file} is empty`);
      }
    } else {
      (doc.required ? errors : warnings).push(`Missing ${doc.file}`);
    }
  }
}

async function validatePackContent() {
  log(`\n${cyan}📂 Simulating package content...${reset}`);

  try {
    // Create a tarball to see what will be published
    const output = execSync('npm pack --dry-run', {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    const lines = output.split('\n');
    const fileCount = lines.filter(l => l.trim().startsWith('npm notice')).length;

    log(`  ${gray}Package will include ${fileCount} files${reset}`);

    // Check for common unwanted files
    const unwantedPatterns = ['.test.', '.spec.', 'test/', 'tests/', '__tests__'];
    const hasUnwanted = lines.some(line =>
      unwantedPatterns.some(pattern => line.includes(pattern))
    );

    if (hasUnwanted) {
      warnings.push('Package may include test files - check "files" field in package.json');
    } else {
      passed.push('No test files in package content');
    }

  } catch (error) {
    warnings.push(`Could not simulate package content: ${error.message}`);
  }
}

async function printSummary() {
  log(`\n${'='.repeat(60)}`);
  log(`${blue}📊 Pre-Publish Validation Summary${reset}`);
  log('='.repeat(60));

  if (passed.length > 0) {
    log(`\n${green}✓ Passed (${passed.length}):${reset}`);
    passed.forEach(msg => log(`  ${gray}• ${msg}${reset}`));
  }

  if (warnings.length > 0) {
    log(`\n${yellow}⚠ Warnings (${warnings.length}):${reset}`);
    warnings.forEach(msg => log(`  ${yellow}• ${msg}${reset}`));
  }

  if (errors.length > 0) {
    log(`\n${red}✗ Errors (${errors.length}):${reset}`);
    errors.forEach(msg => log(`  ${red}• ${msg}${reset}`));
  }

  log('\n' + '='.repeat(60));

  if (errors.length === 0) {
    if (warnings.length === 0) {
      log(`${green}🎉 All checks passed! Package is ready to publish.${reset}\n`);
      return 0;
    } else {
      log(`${yellow}⚠️  Package can be published, but review warnings.${reset}\n`);
      return 0;
    }
  } else {
    log(`${red}❌ Package is NOT ready to publish. Fix errors first.${reset}\n`);
    return 1;
  }
}

// Main execution
async function main() {
  log(`${blue}${'='.repeat(60)}${reset}`);
  log(`${blue}🚀 Pre-Publish Validation for vault-storage${reset}`);
  log(`${blue}${'='.repeat(60)}${reset}`);

  await validatePackageJson();
  await validateBuildFiles();
  await validateTests();
  await validateSize();
  await validateDocumentation();
  await validatePackContent();

  const exitCode = await printSummary();
  process.exit(exitCode);
}

main().catch(error => {
  console.error(`${red}Fatal error: ${error.message}${reset}`);
  process.exit(1);
});
