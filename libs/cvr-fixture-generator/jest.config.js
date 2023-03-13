const shared = require('../../jest.config.shared');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...shared,
  collectCoverageFrom: [...shared.collectCoverageFrom, '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      statements: 99,
      branches: 80,
      functions: 100,
      lines: 99,
    },
  },
};
