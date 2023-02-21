// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import '@testing-library/cypress/add-commands';
import './commands';

import { electionSampleDefinition } from '@votingworks/fixtures';
import { CardData } from '@votingworks/types';
import { methodUrl } from '@votingworks/grout';

const ELECTION_MANAGER_CARD_DATA = {
  t: 'election_manager',
  h: electionSampleDefinition.electionHash,
  p: '000000',
};

const POLL_WORKER_CARD_DATA = {
  t: 'poll_worker',
  h: electionSampleDefinition.electionHash,
};

/**
 * 
 * @param {CardData} card
 * @param {string=} longValue 
 * @returns {void}
 */
function insertCard(card, longValue) {
  cy.request({
    method: 'PUT',
    url: 'http://localhost:3001/mock',
    body: JSON.stringify({
      enabled: true,
      shortValue: JSON.stringify(card),
      longValue,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * @returns {void}
 */
function removeCard() {
  cy.request({
    method: 'PUT',
    url: 'http://localhost:3001/mock',
    body: JSON.stringify({
      enabled: true,
      hasCard: false,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function endCardlessVoterSession() {
  cy.request('POST', methodUrl('endCardlessVoterSession', 'http://localhost:3000/api'), {});
}

beforeEach(() => {
  endCardlessVoterSession();

  insertCard(ELECTION_MANAGER_CARD_DATA, electionSampleDefinition.electionData);
  cy.visit('/');

  // Authenticate
  for (const digit of ELECTION_MANAGER_CARD_DATA.p) {
    cy.contains(digit).click();
  }

  // Load election
  cy.contains('Load Election Definition').click();
  cy.get('#selectPrecinct').select('All Precincts');
  removeCard();

  // Back at the home screen
  cy.contains('Insert Poll Worker card to open');

  // Open polls
  insertCard(POLL_WORKER_CARD_DATA);
  cy.contains('Open Polls').click();
  cy.contains('Open Polls on VxMark Now').click();

  // Activate ballot
  cy.contains('Center Springfield').click();
  cy.contains('12').click();
  removeCard();
});
