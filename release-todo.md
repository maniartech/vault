# Release Checklist for vault-storage v2.0.0-alpha.1

## 1. 🚨 Critical Issues (Must Fix Before Publishing)

- [x] ~~**Fix package.json JSON syntax errors**~~ - DONE
  - [x] ~~Line 43: Add missing comma after "types": "./dist/index.mini.d.ts"~~ - FIXED
  - [x] ~~Line 74: Add missing comma after vault export block (before encrypted-vault)~~ - FIXED

- [x] ~~**Fix "files" field in package.json**~~ - DONE
  - [x] ~~Change from `["./dist/"]` to `["dist/"]` (remove leading ./)~~ - FIXED

## 2. ⚠️ Pre-Alpha Release Tasks

### Code Cleanup
- [x] ~~Remove `tests/events-system.spec.js.bak` (backup file)~~ - DONE
- [x] ~~Remove or re-enable `tests/events-system.spec.js.disabled`~~ - REPLACED with new `events-system.spec.js` (24 tests, all passing)
- [x] ~~Review and clean up any other temporary files~~ - No other temp files found

### Build & Test Validation (⚠️ Run these before publishing)

- [ ] 🔄 Run `yarn clean` successfully
- [ ] 🔄 Run `yarn build` successfully
- [ ] 🔄 Verify all dist files are generated correctly
- [ ] 🔄 Run `yarn test` - ensure all tests pass (currently 352/352 passing ✓)
- [ ] 🔄 Run `yarn size:check` - verify size limits are met
- [ ] 🔄 Check that TypeScript types are generated properly
- [ ] 🔄 **Run `yarn prepublish:check`** - comprehensive pre-publish validation

### Package Validation (⚠️ Run these before publishing)

- [ ] 🔄 Validate package.json: `yarn info vault-storage`
- [ ] 🔄 Test local package: `yarn pack`
- [ ] 🔄 Test installation: `yarn add ./vault-storage-v2.0.0-alpha.1.tgz`
- [ ] 🔄 Verify all exports work correctly:
  - [ ] 🔄 `import vault from 'vault-storage'`
  - [ ] 🔄 `import { Vault } from 'vault-storage/vault'`
  - [ ] 🔄 `import { EncryptedVault } from 'vault-storage/encrypted-vault'`
  - [ ] 🔄 `import { validation, expiration, encryption } from 'vault-storage/middlewares'`
  - [ ] 🔄 `import backup from 'vault-storage/backup'`

### Documentation Review

- [x] ~~Update README.md for v2.0.0 changes (if needed)~~ - Current README is good for alpha
- [x] ~~Verify LICENSE file is present and correct~~ - LICENSE exists
- [x] ~~Check that keywords in package.json are relevant~~ - Keywords are appropriate

## 3. 📝 Before Stable Release (Post-Alpha)

### Documentation

- [ ] Create CHANGELOG.md documenting all changes from v1.x
- [ ] Add CONTRIBUTING.md guidelines
- [ ] Add API documentation
- [ ] Update examples in docs/ folder

### Version Management
- [ ] Remove alpha tag from version when ready for stable
- [ ] Set proper npm dist-tags for alpha release
- [ ] Plan migration guide for users upgrading from v1.x

### Quality Assurance

- [ ] Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test with different bundlers (webpack, rollup, vite, esbuild)
- [ ] Performance benchmarks vs v1.x
- [ ] Security audit of dependencies

## 4. 📦 Publishing Steps (⚠️ Execute in order when ready)

1. [ ] 🔄 **Run final validation: `yarn prepublish:check`**
2. [x] ~~Ensure all critical issues are resolved~~ - All critical issues fixed ✓
3. [ ] 🔄 Commit all changes
4. [ ] 🔄 Create git tag: `git tag v2.0.0-alpha.1`
5. [ ] 🔄 Push with tags: `git push origin master --tags`
6. [ ] 🔄 Publish to npm: `yarn publish --tag alpha`
7. [ ] 🔄 Verify package on npmjs.com
8. [ ] 🔄 Test installation: `yarn add vault-storage@alpha`

## 5. 🔍 Post-Publication

- [ ] Monitor npm download stats
- [ ] Watch for GitHub issues
- [ ] Gather feedback from alpha users
- [ ] Plan beta release timeline

---

## Notes

- **Current Version**: 2.0.0-alpha.1
- **Target Audience**: Early adopters and testers
- **Breaking Changes**: Yes (v1.x → v2.x)
- **Minimum Node**: Check compatibility requirements

## Quick Commands

```bash
# Pre-publish validation (RUN THIS FIRST!)
yarn prepublish:check

# Validate and build
yarn info vault-storage
yarn clean && yarn build
yarn test
yarn size:check

# Test package locally
yarn pack
yarn add ./vault-storage-v2.0.0-alpha.1.tgz --check-files

# Publish (when ready)
yarn publish --tag alpha
```
