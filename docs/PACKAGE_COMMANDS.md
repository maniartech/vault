# Package Preview Commands

This document describes the package preview and inspection commands available in the project.

## Available Commands

### `yarn pack:preview`
**Creates and extracts the package tarball for inspection**

```bash
yarn pack:preview
```

**What it does:**
1. Runs `yarn pack` to create the tarball
2. Creates `.temp/package-preview/` directory
3. Extracts the tarball to `.temp/package-preview/package/`
4. Shows confirmation message

**Output:**
- Tarball: `vault-storage-v2.0.0-alpha.1.tgz`
- Extracted package: `.temp/package-preview/package/`

**Use this when:** You want to see exactly what will be published to npm

---

### `yarn pack:list`
**Lists all files that will be included in the package**

```bash
yarn pack:list
```

**What it does:**
- Runs `npm pack --dry-run` to show what would be included
- No tarball is created
- Fast way to see file list

**Use this when:** You want a quick file list without creating the tarball

---

### `yarn pack:inspect`
**Creates package and shows detailed file listing**

```bash
yarn pack:inspect
```

**What it does:**
1. Runs `yarn pack:preview`
2. Lists all files in the package (sorted)
3. Shows full file paths

**Output example:**
```
📦 Package Contents:
./dist/backup.d.ts
./dist/backup.js
./dist/encrypted-vault.d.ts
./dist/encrypted-vault.js
...
```

**Use this when:** You need to verify specific files are included/excluded

---

### `yarn pack:size`
**Shows package size information**

```bash
yarn pack:size
```

**What it does:**
1. Creates the tarball
2. Shows compressed tarball size
3. Shows extracted package size (if already extracted)

**Output example:**
```
-rw-r--r-- 1 user 197609 25K Oct 8 22:39 vault-storage-v2.0.0-alpha.1.tgz

50K    .temp/package-preview/package
```

**Use this when:** You want to check package size limits

---

### `yarn pack:clean`
**Removes all package preview files**

```bash
yarn pack:clean
```

**What it does:**
1. Deletes all `vault-storage-*.tgz` files
2. Removes `.temp/package-preview/` directory
3. Shows confirmation

**Use this when:** You want to clean up after preview/testing

---

## Complete Workflow Example

### Before Publishing - Full Inspection

```bash
# 1. Clean old preview files
yarn pack:clean

# 2. Preview the package
yarn pack:preview

# 3. Inspect contents
yarn pack:inspect

# 4. Check size
yarn pack:size

# 5. Browse manually
cd .temp/package-preview/package
ls -la
cat package.json

# 6. Test local installation
cd ../../../  # Back to project root
yarn add ./vault-storage-v2.0.0-alpha.1.tgz

# 7. Clean up
yarn pack:clean
```

### Quick Check

```bash
# Just see what would be included
yarn pack:list
```

### Size Check Only

```bash
yarn pack:size
```

---

## Related Commands

These commands work well with other package validation commands:

```bash
# Pre-publish validation
yarn prepublish:check

# Build the project
yarn build

# Run tests
yarn test

# Check bundle sizes
yarn size:check
```

---

## Tips

### Verify Package Contents

After running `yarn pack:preview`, you can:

1. **Browse the directory:**
   ```bash
   cd .temp/package-preview/package
   ls -la dist/
   ```

2. **Check package.json:**
   ```bash
   cat .temp/package-preview/package/package.json
   ```

3. **Verify README:**
   ```bash
   cat .temp/package-preview/package/README.md
   ```

4. **Test imports locally:**
   ```bash
   node -e "import('./vault-storage-v2.0.0-alpha.1.tgz').then(console.log)"
   ```

### Common Checks

**Ensure no test files leaked:**
```bash
yarn pack:inspect | grep -i test
# Should return nothing
```

**Ensure no source files leaked:**
```bash
yarn pack:inspect | grep -E '\.(ts|tsx)$' | grep -v '\.d\.ts'
# Should return nothing
```

**Count files:**
```bash
yarn pack:inspect | wc -l
```

**Check for specific files:**
```bash
yarn pack:inspect | grep LICENSE
yarn pack:inspect | grep README
```

---

## What Gets Included?

The package includes files based on:

1. **`files` field in package.json:**
   ```json
   "files": ["dist/", "scripts/"]
   ```

2. **Always included (by npm):**
   - package.json
   - README.md
   - LICENSE

3. **Always excluded (by npm):**
   - .git/
   - node_modules/
   - .gitignore
   - .npmignore (if present)

4. **Your .gitignore rules** are respected by default

---

## Troubleshooting

### "No such file or directory" when running pack:size

**Solution:** Run `yarn pack:preview` first to create the extracted package.

### Tarball already exists

**Solution:** Run `yarn pack:clean` first to remove old tarballs.

### Can't find extracted package

**Solution:** Make sure you're in the project root directory and run `yarn pack:preview`.

---

## Integration with Publishing Workflow

Add this to your release checklist:

```bash
# Before publishing
yarn pack:clean           # Clean old files
yarn prepublish:check     # Run validation
yarn pack:preview         # Create and extract package
yarn pack:inspect         # Verify contents
yarn pack:size            # Check size

# Review manually
cd .temp/package-preview/package && ls -la

# If everything looks good, publish
yarn publish --tag alpha

# Clean up
yarn pack:clean
```

---

**See also:**
- `.temp/PACKAGE_PREVIEW.md` - Detailed package preview documentation
- `scripts/pre-publish.js` - Pre-publish validation script
- `release-todo.md` - Complete release checklist
