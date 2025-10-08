# Build Scripts

This directory contains build and validation scripts for the vault-storage package.

## Scripts Overview

### `build.js`
Builds the vault library using esbuild. Supports multiple entry points and can run in watch mode.

**Usage:**
```bash
yarn build:vault
# or with watch mode
yarn watch
```

**Features:**
- Recursive entry point detection
- Multiple output formats (ESM, CJS)
- Minification support
- Watch mode for development
- TypeScript compilation

---

### `clean.js`
Cleans build artifacts and generated files.

**Usage:**
```bash
yarn clean
```

**Removes:**
- `dist/` directory
- Generated type definitions
- Build caches

---

### `gzip-and-measure.js`
Measures and validates the size of built files to ensure they meet size requirements.

**Usage:**
```bash
# Check individual file sizes
yarn size:check

# Check bundled size
yarn size:bundle:check
```

**Features:**
- Gzip compression measurement
- Size threshold validation
- Per-file and bundled analysis
- Configurable limits

---

### `pre-publish.js` ⭐ NEW
Comprehensive pre-publish validation script that checks if the package is ready for publishing.

**Usage:**
```bash
yarn prepublish:check
```

**What it validates:**

#### 📋 Package.json
- ✓ Required fields (name, version, main, types, exports, license)
- ✓ Files field format (no leading `./`)
- ✓ Version format warnings (alpha/beta tags)
- ✓ Export paths exist in dist/

#### 🔨 Build Files
- ✓ All expected dist files exist
- ✓ No empty build files
- ✓ File sizes reported
- ✓ TypeScript definitions generated

#### 🧪 Tests
- ✓ No disabled/backup test files (.bak, .disabled)
- ✓ All tests pass
- ✓ Test suite runs successfully

#### 📦 Bundle Size
- ✓ Size within configured limits
- ✓ Reports gzipped sizes

#### 📚 Documentation
- ✓ README.md exists
- ✓ LICENSE exists
- ✓ CHANGELOG.md (warning if missing)

#### 📂 Package Content
- ✓ Simulates what will be published
- ✓ Checks for unwanted files (test files, etc.)
- ✓ Validates "files" field configuration

**Output:**
The script provides color-coded output:
- 🟢 Green: Passed checks
- 🟡 Yellow: Warnings (won't block publish)
- 🔴 Red: Errors (must fix before publishing)

**Exit codes:**
- `0`: Ready to publish (or with warnings)
- `1`: Not ready - has errors

---

## Workflow

### Development
```bash
# Watch mode for active development
yarn watch

# Run tests
yarn test
```

### Before Committing
```bash
# Clean and rebuild
yarn clean && yarn build

# Run tests
yarn test

# Check sizes
yarn size:check
```

### Before Publishing
```bash
# Run comprehensive validation
yarn prepublish:check

# If all checks pass, publish
yarn publish --tag alpha
```

---

## Size Thresholds

The `gzip-and-measure.js` script enforces size limits to keep the library lightweight:

- Individual files: Configured per file
- Bundle size: Total package size limits

If sizes exceed thresholds, the build will fail with suggestions for optimization.

---

## Adding New Scripts

When adding new build scripts:

1. Place them in the `scripts/` directory
2. Use ES modules (`.js` with `"type": "module"` in package.json)
3. Add corresponding npm script in `package.json`
4. Document it here in this README
5. Include error handling and user-friendly output

---

## Troubleshooting

### Pre-publish check fails
1. Read the error messages carefully
2. Fix any red (error) items first
3. Review yellow (warning) items
4. Re-run `yarn prepublish:check`

### Build fails
1. Run `yarn clean` first
2. Check for TypeScript errors: `yarn build:types`
3. Verify all dependencies are installed: `yarn install`

### Size check fails
1. Check which files exceed limits
2. Review bundle composition
3. Consider code splitting or removing unused exports
4. Update thresholds if legitimate growth
