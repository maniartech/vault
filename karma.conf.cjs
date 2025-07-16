// Karma configuration
// Generated on Sun Dec 31 2023 20:56:35 GMT+0530 (India Standard Time)

const { type } = require("os")

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser
    files: [
      { pattern: './backup.js', type: 'module' },
      { pattern: './backup.d.ts', included: false },
      { pattern: './index.js', type: 'module' },
      { pattern: './index.d.ts', included: false },
      { pattern: './secured-vault.js', type: 'module' },
      { pattern: './secured-vault.d.ts', included: false },
      { pattern: './vault.js', type: 'module' },
      { pattern: './vault.d.ts', included: false },
      { pattern: './proxy-handler.js', type: 'module' },
      { pattern: './proxy-handler.d.ts', included: false },
      { pattern: './types/**/*.js', type: 'module' },
      { pattern: './types/**/*.d.ts', included: false },
      { pattern: './middlewares/**/*.js', type: 'module' },
      { pattern: './middlewares/**/*.d.ts', included: false },
      { pattern: './tests/*.spec.js', type: 'module' },
    ],

    // list of files / patterns to exclude
    exclude: [
      // 'node_modules/**'
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
    preprocessors: {
      '**/*.js': ['sourcemap']
    },

    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-sourcemap-loader',
      'karma-spec-reporter'
    ],

    karmaTypescriptConfig: {
      tsconfig: './tsconfig.json'
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ['progress', 'spec'],

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_DEBUG,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    browsers: [
      'Chrome',
      // 'Firefox'
    ],

    // Custom launcher for better debugging
    customLaunchers: {
      ChromeDebugging: {
        base: 'Chrome',
        flags: ['--remote-debugging-port=9333', '--disable-web-security', '--disable-features=VizDisplayCompositor']
      }
    },

    // Browser console log level
    browserConsoleLogOptions: {
      level: 'log',
      format: '%b %T: %m',
      terminal: true
    },

    // Capture browser console output
    captureConsole: true,

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity,

    mime: {
      'text/javascript': ['js', 'mjs']
    }
  })
}
