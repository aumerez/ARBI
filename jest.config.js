module.exports = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test discovery pattern - find all .spec.ts files
  testMatch: ['**/*.spec.ts'],

  // Coverage configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // File extensions to resolve
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Transform TypeScript files using ts-jest
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // Test timeout (30 seconds)
  testTimeout: 30000,

  // Verbose output for clarity
  verbose: true,

  // Handle ESM compatibility if needed
  // moduleNameMapper: {},

  // Test path ignore patterns
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/coverage/'],

  // Babel config (if needed, but ts-jest typically handles this)
  // transformIgnorePatterns: [],

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Watchman optimization for macOS
  watchman: true,

  // Maximum worker pool threads
  maxWorkers: '50%',
};
