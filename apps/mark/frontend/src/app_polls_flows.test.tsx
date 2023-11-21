import { hasTextAcrossElements } from '@votingworks/test-utils';
import userEvent from '@testing-library/user-event';
import { electionGeneralDefinition } from '@votingworks/fixtures';
import { ALL_PRECINCTS_SELECTION } from '@votingworks/utils';
import { screen, waitFor, within } from '../test/react_testing_library';
import { buildApp } from '../test/helpers/build_app';
import { ApiMock, createApiMock } from '../test/helpers/mock_api_client';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

jest.setTimeout(15000);

test('full polls flow', async () => {
  apiMock = createApiMock();
  apiMock.expectGetMachineConfig();
  apiMock.expectGetSystemSettings();
  apiMock.expectGetElectionDefinition(electionGeneralDefinition);
  const { renderApp } = buildApp(apiMock);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
    pollsState: 'polls_closed_initial',
  });

  renderApp();
  await screen.findByText('Polls Closed');
  screen.getByText('Insert Poll Worker card to open.');

  // Open Polls
  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetElectionState({
    pollsState: 'polls_open',
  });
  await screen.findByText(hasTextAcrossElements('Polls: Closed'));
  userEvent.click(await screen.findByText('Open Polls'));
  const openModal = await screen.findByRole('alertdialog');
  userEvent.click(within(openModal).getByText('Open Polls'));
  await screen.findByText(hasTextAcrossElements('Polls: Open'));
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');

  // Pause Voting
  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);
  apiMock.expectSetPollsState('polls_paused');
  apiMock.expectGetElectionState({
    pollsState: 'polls_paused',
  });
  await screen.findByText(hasTextAcrossElements('Polls: Open'));
  userEvent.click(screen.getByText('View More Actions'));
  userEvent.click(await screen.findByText('Pause Voting'));
  const pauseModal = await screen.findByRole('alertdialog');
  userEvent.click(within(pauseModal).getByText('Pause Voting'));
  await screen.findByText(hasTextAcrossElements('Polls: Paused'));
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Voting Paused');

  // Resume Voting
  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);
  apiMock.expectSetPollsState('polls_open');
  apiMock.expectGetElectionState({
    pollsState: 'polls_open',
  });
  await screen.findByText(hasTextAcrossElements('Polls: Paused'));
  userEvent.click(await screen.findByText('Resume Voting'));
  const resumeModal = await screen.findByRole('alertdialog');
  userEvent.click(within(resumeModal).getByText('Resume Voting'));
  await screen.findByText(hasTextAcrossElements('Polls: Open'));
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Insert Card');

  // Close Polls
  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetElectionState({
    pollsState: 'polls_closed_final',
  });
  await screen.findByText(hasTextAcrossElements('Polls: Open'));
  userEvent.click(screen.getByText('View More Actions'));
  userEvent.click(screen.getByText('Close Polls'));
  const closeModal = await screen.findByRole('alertdialog');
  userEvent.click(within(closeModal).getByText('Close Polls'));
  await screen.findByText(hasTextAcrossElements('Polls: Closed'));
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Polls Closed');
  screen.getByText('Voting is complete.');
});

test('can close polls from paused', async () => {
  const { renderApp } = buildApp(apiMock);
  apiMock.expectGetElectionDefinition(electionGeneralDefinition);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
    pollsState: 'polls_paused',
  });

  renderApp();
  await screen.findByText('Voting Paused');
  screen.getByText('Insert Poll Worker card to resume voting.');

  // Close Polls
  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);
  apiMock.expectSetPollsState('polls_closed_final');
  apiMock.expectGetElectionState({
    pollsState: 'polls_closed_final',
  });
  await screen.findByText(hasTextAcrossElements('Polls: Paused'));
  userEvent.click(screen.getByText('Close Polls'));
  const closeModal = await screen.findByRole('alertdialog');
  userEvent.click(within(closeModal).getByText('Close Polls'));
  await screen.findByText(hasTextAcrossElements('Polls: Closed'));
  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Polls Closed');
  screen.getByText('Voting is complete.');
});

test('no buttons to change polls from closed final', async () => {
  const { renderApp } = buildApp(apiMock);
  apiMock.expectGetElectionDefinition(electionGeneralDefinition);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
    pollsState: 'polls_closed_final',
  });

  renderApp();
  await screen.findByText('Polls Closed');
  screen.getByText('Voting is complete.');

  apiMock.setAuthStatusPollWorkerLoggedIn(electionGeneralDefinition);
  await screen.findByText(hasTextAcrossElements('Polls: Closed'));
  expect(
    screen.queryByRole('button', { name: /open/i })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /pause/i })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /close/i })
  ).not.toBeInTheDocument();
});

test('can reset polls to paused with system administrator card', async () => {
  const { renderApp } = buildApp(apiMock);
  apiMock.expectGetElectionDefinition(electionGeneralDefinition);
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
    pollsState: 'polls_closed_final',
  });

  renderApp();
  await screen.findByText('Polls Closed');
  apiMock.setAuthStatusSystemAdministratorLoggedIn();
  apiMock.expectSetPollsState('polls_paused');
  apiMock.expectGetElectionState({
    pollsState: 'polls_paused',
  });

  userEvent.click(await screen.findByText('Reset Polls to Paused'));
  const modal = await screen.findByRole('alertdialog');
  userEvent.click(
    await within(modal).findByRole('button', { name: 'Reset Polls to Paused' })
  );
  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  expect(
    screen.getByText('Reset Polls to Paused').closest('button')!
  ).toBeDisabled();

  apiMock.setAuthStatusLoggedOut();
  await screen.findByText('Voting Paused');
});
