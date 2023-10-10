import { MemoryStorage, MemoryHardware } from '@votingworks/utils';
import { FakeKiosk, expectPrint, fakeKiosk } from '@votingworks/test-utils';
import { electionGeneralDefinition } from '@votingworks/fixtures';
import userEvent from '@testing-library/user-event';
import {
  fireEvent,
  render,
  screen,
  within,
} from '../test/react_testing_library';
import * as GLOBALS from './config/globals';

import { App } from './app';

import {
  presidentContest,
  setElectionInStorage,
  setStateInStorage,
  voterContests,
} from '../test/helpers/election';
import { withMarkup } from '../test/helpers/with_markup';
import { advanceTimersAndPromises } from '../test/helpers/timers';
import { ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { configureFromUsbThenRemove } from '../test/helpers/ballot_package';

let apiMock: ApiMock;
let kiosk: FakeKiosk;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
  kiosk = fakeKiosk();
  window.kiosk = kiosk;
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

jest.setTimeout(30000);

test('Cardless Voting Flow', async () => {
  const electionDefinition = electionGeneralDefinition;
  const { electionHash } = electionDefinition;
  const hardware = MemoryHardware.buildStandard();
  const storage = new MemoryStorage();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  render(
    <App
      hardware={hardware}
      apiClient={apiMock.mockApiClient}
      storage={storage}
      reload={jest.fn()}
    />
  );
  const findByTextWithMarkup = withMarkup(screen.findByText);

  apiMock.setAuthStatusLoggedOut();

  // Default Unconfigured
  await screen.findByText('VxMark is Not Configured');

  // ---------------

  // Configure with Election Manager Card
  apiMock.setAuthStatusElectionManagerLoggedIn(electionDefinition);

  await configureFromUsbThenRemove(apiMock, screen, electionDefinition);

  await screen.findByText('Election Definition is loaded.');
  screen.getByLabelText('Precinct');
  screen.queryByText(`Election ID: ${electionHash.slice(0, 10)}`);

  // Select precinct
  screen.getByText('State of Hamilton');
  const precinctSelect = screen.getByLabelText('Precinct');
  const precinctId =
    within(precinctSelect).getByText<HTMLOptionElement>(
      'Center Springfield'
    ).value;
  fireEvent.change(precinctSelect, { target: { value: precinctId } });
  within(screen.getByTestId('electionInfoBar')).getByText(/Center Springfield/);

  fireEvent.click(
    screen.getByRole('option', {
      name: 'Official Ballot Mode',
      selected: false,
    })
  );
  screen.getByRole('option', { name: 'Official Ballot Mode', selected: true });

  // Remove card
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Polls Closed');
  screen.getByText('Insert Poll Worker card to open.');

  // ---------------

  // Open Polls with Poll Worker Card
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  userEvent.click(await screen.findByText('Open Polls'));
  userEvent.click(
    within(await screen.findByRole('alertdialog')).getByText('Open Polls')
  );
  await findByTextWithMarkup('Polls: Open');

  // Remove card
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');

  // ---------------

  // Activate Voter Session for Cardless Voter
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await screen.findByText('Select Voter’s Ballot Style');
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  fireEvent.click(within(screen.getByTestId('ballot-styles')).getByText('12'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  screen.getByText(/(12)/);

  // Poll Worker deactivates ballot style
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  userEvent.click(await screen.findByText('Deactivate Voting Session'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await screen.findByText('Select Voter’s Ballot Style');

  // Poll Worker reactivates ballot style
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  fireEvent.click(within(screen.getByTestId('ballot-styles')).getByText('12'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });

  // Poll Worker removes their card
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '12',
    precinctId: '23',
  });

  // Voter Ballot Style is active
  await findByTextWithMarkup('Your ballot has 20 contests.');
  screen.getByText(/(12)/);
  fireEvent.click(screen.getByText('Start Voting'));

  // Voter votes in first contest
  fireEvent.click(screen.getByText(presidentContest.candidates[0].name));
  fireEvent.click(screen.getByText('Next'));

  // Poll Worker inserts card and sees message that there are votes
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Ballot Contains Votes');

  // Poll Worker resets ballot to remove votes
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  fireEvent.click(screen.getByText('Reset Ballot'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);

  // Back on Poll Worker screen
  await screen.findByText('Select Voter’s Ballot Style');

  // Activates Ballot Style again
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  fireEvent.click(within(screen.getByTestId('ballot-styles')).getByText('12'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Voting Session Active: 12 at Center Springfield');

  // Poll Worker removes their card
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '12',
    precinctId: '23',
  });

  // Voter Ballot Style is active
  await findByTextWithMarkup('Your ballot has 20 contests.');
  screen.getByText(/(12)/);
  fireEvent.click(screen.getByText('Start Voting'));

  // Voter makes selection in first contest and then advances to review screen
  for (let i = 0; i < voterContests.length; i += 1) {
    const { title } = voterContests[i];

    await screen.findByText(title);

    // Vote for a candidate contest
    if (title === presidentContest.title) {
      fireEvent.click(screen.getByText(presidentContest.candidates[0].name));
    }
    fireEvent.click(screen.getByText('Next'));
  }

  // Advance to print ballot
  fireEvent.click(screen.getByText(/Print My ballot/i));
  screen.getByText(/Printing Your Official Ballot/i);
  await expectPrint();

  // Reset ballot
  await advanceTimersAndPromises();

  // Expire timeout for display of "Printing Ballot" screen
  await advanceTimersAndPromises(GLOBALS.BALLOT_PRINTING_TIMEOUT_SECONDS);

  // Reset Ballot is called
  // Show Verify and Scan Instructions
  screen.getByText('You’re Almost Done');
  expect(
    screen.queryByText('3. Return the card to a poll worker.')
  ).toBeFalsy();

  // Wait for timeout to return to Insert Card screen
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  await advanceTimersAndPromises(GLOBALS.BALLOT_INSTRUCTIONS_TIMEOUT_SECONDS);
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');
});

test('Another Voter submits blank ballot and clicks Done', async () => {
  // ====================== BEGIN CONTEST SETUP ====================== //

  const electionDefinition = electionGeneralDefinition;
  const hardware = MemoryHardware.buildStandard();
  const storage = new MemoryStorage();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);

  await setElectionInStorage(storage, electionGeneralDefinition);
  await setStateInStorage(storage);

  render(
    <App
      hardware={hardware}
      storage={storage}
      apiClient={apiMock.mockApiClient}
      reload={jest.fn()}
    />
  );

  const findByTextWithMarkup = withMarkup(screen.findByText);

  // ====================== END CONTEST SETUP ====================== //

  // Activate Voter Session for Cardless Voter
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  userEvent.click(
    within(await screen.findByTestId('ballot-styles')).getByText('12')
  );
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Voting Session Active: 12 at Center Springfield');

  // Poll Worker removes their card
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '12',
    precinctId: '23',
  });

  // Voter Ballot Style is active
  await findByTextWithMarkup('Your ballot has 20 contests.');
  screen.getByText(/(12)/);
  fireEvent.click(screen.getByText('Start Voting'));

  // Voter advances through contests without voting in any
  for (let i = 0; i < voterContests.length; i += 1) {
    const { title } = voterContests[i];

    await advanceTimersAndPromises();
    screen.getByText(title);

    fireEvent.click(screen.getByText('Next'));
  }

  // Advance to print ballot
  fireEvent.click(screen.getByText(/Print My ballot/i));
  screen.getByText(/Printing Your Official Ballot/i);
  await expectPrint();

  // Reset ballot
  await advanceTimersAndPromises();

  // Expire timeout for display of "Printing Ballot" screen
  await advanceTimersAndPromises(GLOBALS.BALLOT_PRINTING_TIMEOUT_SECONDS);

  // Reset Ballot is called
  // Show Verify and Scan Instructions
  screen.getByText('You’re Almost Done');
  expect(screen.queryByText('3. Return the card.')).toBeFalsy();

  // Click "Done" to get back to Insert Card screen
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  fireEvent.click(screen.getByText('Done'));
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');
});

test('poll worker must select a precinct first', async () => {
  const electionDefinition = electionGeneralDefinition;
  const { electionHash } = electionDefinition;
  const hardware = MemoryHardware.buildStandard();
  const storage = new MemoryStorage();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(null);
  render(
    <App
      hardware={hardware}
      apiClient={apiMock.mockApiClient}
      storage={storage}
      reload={jest.fn()}
    />
  );
  const findByTextWithMarkup = withMarkup(screen.findByText);

  // Default Unconfigured
  await screen.findByText('VxMark is Not Configured');

  // ---------------

  // Configure with Election Manager Card and USB
  apiMock.setAuthStatusElectionManagerLoggedIn(electionDefinition);
  await configureFromUsbThenRemove(apiMock, screen, electionDefinition);
  await screen.findByText('Election Definition is loaded.');
  screen.getByLabelText('Precinct');
  screen.queryByText(`Election ID: ${electionHash.slice(0, 10)}`);

  // Select precinct
  screen.getByText('State of Hamilton');
  const precinctSelect = screen.getByLabelText('Precinct');
  const precinctId =
    within(precinctSelect).getByText<HTMLOptionElement>('All Precincts').value;
  fireEvent.change(precinctSelect, { target: { value: precinctId } });
  within(screen.getByTestId('electionInfoBar')).getByText(/All Precincts/);

  fireEvent.click(
    screen.getByRole('option', {
      name: 'Official Ballot Mode',
      selected: false,
    })
  );
  screen.getByRole('option', {
    name: 'Official Ballot Mode',
    selected: true,
  });

  // Remove card
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Polls Closed');
  screen.getByText('Insert Poll Worker card to open.');

  // ---------------

  // Open Polls with Poll Worker Card
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  userEvent.click(await screen.findByText('Open Polls'));
  userEvent.click(
    within(await screen.findByRole('alertdialog')).getByText('Open Polls')
  );
  await findByTextWithMarkup('Polls: Open');

  // Remove card
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');

  // ---------------

  // Activate Voter Session for Cardless Voter
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await screen.findByText('1. Select Voter’s Precinct');
  fireEvent.click(
    within(screen.getByTestId('precincts')).getByText('Center Springfield')
  );
  screen.getByText('2. Select Voter’s Ballot Style');
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  fireEvent.click(within(screen.getByTestId('ballot-styles')).getByText('12'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Voting Session Active: 12 at Center Springfield');

  // Poll Worker deactivates ballot style
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  fireEvent.click(screen.getByText('Deactivate Voting Session'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);
  await screen.findByText('2. Select Voter’s Ballot Style');

  // Poll Worker reactivates ballot style
  userEvent.click(
    within(screen.getByTestId('precincts')).getByText('Center Springfield')
  );
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  userEvent.click(within(screen.getByTestId('ballot-styles')).getByText('12'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Voting Session Active: 12 at Center Springfield');

  // Poll Worker removes their card
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '12',
    precinctId: '23',
  });

  // Voter Ballot Style is active
  await findByTextWithMarkup('Your ballot has 20 contests.');
  screen.getByText(/(12)/);
  userEvent.click(screen.getByText('Start Voting'));

  // Voter votes in first contest
  userEvent.click(screen.getByText(presidentContest.candidates[0].name));
  userEvent.click(screen.getByText('Next'));

  // Poll Worker inserts card and sees message that there are votes
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Ballot Contains Votes');

  // Poll Worker resets ballot to remove votes
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  fireEvent.click(screen.getByText('Reset Ballot'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition);

  // Back on Poll Worker screen
  await screen.findByText('1. Select Voter’s Precinct');

  // Activates Ballot Style again
  fireEvent.click(
    within(screen.getByTestId('precincts')).getByText('Center Springfield')
  );
  screen.getByText('2. Select Voter’s Ballot Style');
  apiMock.mockApiClient.startCardlessVoterSession
    .expectCallWith({ ballotStyleId: '12', precinctId: '23' })
    .resolves();
  fireEvent.click(within(screen.getByTestId('ballot-styles')).getByText('12'));
  apiMock.setAuthStatusPollWorkerLoggedIn(electionDefinition, {
    cardlessVoterUserParams: {
      ballotStyleId: '12',
      precinctId: '23',
    },
  });
  await screen.findByText('Voting Session Active: 12 at Center Springfield');

  // Poll Worker removes their card
  apiMock.setAuthStatusCardlessVoterLoggedIn({
    ballotStyleId: '12',
    precinctId: '23',
  });

  // Voter Ballot Style is active
  await findByTextWithMarkup('Your ballot has 20 contests.');
  screen.getByText(/(12)/);
  fireEvent.click(screen.getByText('Start Voting'));

  // Voter makes selection in first contest and then advances to review screen
  for (let i = 0; i < voterContests.length; i += 1) {
    const { title } = voterContests[i];

    await advanceTimersAndPromises();
    screen.getByText(title);

    // Vote for a candidate contest
    if (title === presidentContest.title) {
      fireEvent.click(screen.getByText(presidentContest.candidates[0].name));
    }

    fireEvent.click(screen.getByText('Next'));
  }

  // Advance to print ballot
  fireEvent.click(screen.getByText(/Print My ballot/i));
  screen.getByText(/Printing Your Official Ballot/i);
  await expectPrint();

  // Reset ballot
  await advanceTimersAndPromises();

  // Expire timeout for display of "Printing Ballot" screen
  await advanceTimersAndPromises(GLOBALS.BALLOT_PRINTING_TIMEOUT_SECONDS);

  // Reset Ballot is called
  // Show Verify and Scan Instructions
  screen.getByText('You’re Almost Done');
  expect(
    screen.queryByText('3. Return the card to a poll worker.')
  ).toBeFalsy();

  // Wait for timeout to return to Insert Card screen
  apiMock.mockApiClient.endCardlessVoterSession.expectCallWith().resolves();
  await advanceTimersAndPromises(GLOBALS.BALLOT_INSTRUCTIONS_TIMEOUT_SECONDS);
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');
});
