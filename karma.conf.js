module.exports = function(config) {
  config.set({
    frameworks: ['jasmine', 'karma-typescript'],
    files: [
      { pattern: 'src/**/*.ts' },
      { pattern: 'tests/**/*.spec.ts' }
    ],
    preprocessors: {
      'src/**/*.ts': ['karma-typescript'],
      'tests/**/*.spec.ts': ['karma-typescript']
    },
    reporters: ['progress', 'karma-typescript'],
    browsers: ['Chrome'],
    karmaTypescriptConfig: {
      tsconfig: './tsconfig.json',
    },
    singleRun: false,
    // logLevel: config.LOG_DEBUG
  });
};
