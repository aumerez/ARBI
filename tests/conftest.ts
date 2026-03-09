import { beforeAll, afterAll } from '@jest/globals';

// Global test setup - this file will be executed before all test suites
beforeAll(() => {
  console.log('Test suite starting...');
});

afterAll(() => {
  console.log('Test suite completed.');
});
