const shared = require('../../../jest.config.shared');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...shared,
  restoreMocks: true,
  // This is here because jest finds `build/__mocks__`,
  // which we should probably make not be there by using smarter
  // tsconfig.json values.
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/node_modules/**', '!test/**/*'],
  coverageThreshold: {
    global: {
      statements: 89,
      branches: 75,
      functions: 90,
      lines: 89,
    },
  },
};
