import { electionFamousNames2021Fixtures } from '@votingworks/fixtures';
import { ALL_PRECINCTS_SELECTION } from '@votingworks/utils';
import { render, screen } from '../test/react_testing_library';
import { ApiMock, createApiMock } from '../test/helpers/mock_api_client';
import { App } from './app';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  window.location.href = '/';
  apiMock = createApiMock();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.mockApiClient.assertComplete();
});

test('machineConfig is fetched from api client by default', async () => {
  apiMock.expectGetMachineConfig({
    codeVersion: 'fake-code-version',
  });
  apiMock.expectGetElectionDefinition(
    electionFamousNames2021Fixtures.electionDefinition
  );
  apiMock.expectGetElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });
  render(<App reload={jest.fn()} apiClient={apiMock.mockApiClient} />);
  apiMock.setAuthStatusPollWorkerLoggedIn(
    electionFamousNames2021Fixtures.electionDefinition
  );
  await screen.findByText('fake-code-version');
});
