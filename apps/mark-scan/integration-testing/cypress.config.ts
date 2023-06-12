import { defineConfig } from 'cypress';

/**
 * Define the configuration for the Cypress tests.
 */
export default defineConfig({
  viewportWidth: 1080,
  viewportHeight: 1920,
  defaultCommandTimeout: 8_000,
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/tests/**/*.cy.{js,jsx,ts,tsx}',
  },
});
