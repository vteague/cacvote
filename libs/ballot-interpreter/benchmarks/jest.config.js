const shared = require('../../../jest.config.shared');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...shared,
  testMatch: ['<rootDir>/**/*.bench.ts'],
  watchPathIgnorePatterns: [
    ...shared.watchPathIgnorePatterns,
    '<rootDir>/results',
  ],
};
