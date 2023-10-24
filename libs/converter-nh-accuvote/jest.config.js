const shared = require('../../jest.config.shared');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...shared,
  coverageThreshold: {
    global: {
      branches: -72,
      lines: -35,
    },
  },
  collectCoverageFrom: [...shared.collectCoverageFrom, '!src/debug.ts'],
};
