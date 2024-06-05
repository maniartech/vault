import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  browsers: [playwrightLauncher({ product: 'chromium' })],
  files: 'tests/**/*.test.ts',
  testFramework: {
    config: {
      timeout: 10000,
    },
  },
};
