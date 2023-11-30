import userEvent from '@testing-library/user-event';
import { fakeKiosk } from '@votingworks/test-utils';
import { createMemoryHistory } from 'history';
import { err, ok } from '@votingworks/basics';
import { screen, waitFor, within } from '../../test/react_testing_library';
import { renderInAppContext } from '../../test/render_in_app_context';
import { SettingsScreenProps, SettingsScreen } from './settings_screen';
import { createMockApiClient, MockApiClient } from '../../test/api';

let mockApiClient: MockApiClient;

beforeEach(() => {
  mockApiClient = createMockApiClient();
});

afterEach(() => {
  mockApiClient.assertComplete();
});

function renderScreen(
  props: Partial<SettingsScreenProps> = {},
  history = createMemoryHistory()
) {
  return renderInAppContext(
    <SettingsScreen canUnconfigure={false} isTestMode={false} {...props} />,
    { apiClient: mockApiClient, history }
  );
}

test('clicking "Save Backup" shows progress', async () => {
  renderScreen();

  mockApiClient.exportCastVoteRecordsToUsbDrive
    .expectCallWith({ isMinimalExport: false })
    .resolves(ok());
  userEvent.click(await screen.findByText('Save Backup'));

  const modal = await screen.findByRole('alertdialog');
  within(modal).getByText('Saving backup');
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  );
  screen.getByText('Save Backup');
});

test('"Delete Ballot Data" and Delete Election Data from VxCentralScan" disabled when canUnconfigure is falsy', () => {
  renderScreen({
    canUnconfigure: false,
  });

  expect(
    screen.getButton('Delete Election Data from VxCentralScan')
  ).toBeDisabled();

  expect(screen.getButton('Delete Ballot Data')).toBeDisabled();
});

test('clicking "Delete Election Data from VxCentralScan" calls backend', async () => {
  const history = createMemoryHistory({ initialEntries: ['/admin'] });
  renderScreen({ canUnconfigure: true }, history);

  // initial button
  userEvent.click(screen.getButton('Delete Election Data from VxCentralScan'));

  // first confirmation
  screen.getByText('Delete all election data?');
  userEvent.click(await screen.findButton('Yes, Delete Election Data'));

  // second confirmation
  mockApiClient.unconfigure
    .expectCallWith({ ignoreBackupRequirement: false })
    .resolves();
  mockApiClient.ejectUsbDrive.expectCallWith().resolves();
  screen.getByText('Are you sure?');
  userEvent.click(
    await screen.findButton('I am sure. Delete all election data.')
  );

  // progress message
  await screen.findByText('Deleting election data');

  // we are redirected to the dashboard
  expect(history.location.pathname).toEqual('/');
});

test('clicking "Delete Ballot Data" calls backend', async () => {
  const history = createMemoryHistory({ initialEntries: ['/admin'] });
  renderScreen({ canUnconfigure: true }, history);

  // initial button
  userEvent.click(screen.getButton('Delete Ballot Data'));

  // confirmation
  mockApiClient.clearBallotData.expectCallWith().resolves();
  screen.getByText('Delete All Scanned Ballot Data?');
  userEvent.click(await screen.findButton('Yes, Delete Ballot Data'));

  // progress message
  await screen.findByText('Deleting ballot data');

  // we are redirected to the dashboard
  expect(history.location.pathname).toEqual('/');
});

test('backup error shows message', async () => {
  renderScreen();

  mockApiClient.exportCastVoteRecordsToUsbDrive
    .expectCallWith({ isMinimalExport: false })
    .resolves(err({ type: 'permission-denied' }));
  userEvent.click(await screen.findByText('Save Backup'));

  const modal = await screen.findByRole('alertdialog');
  within(modal).getByText('Saving backup');
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  );
  screen.getByText('Save Backup');
  screen.getByText('Unable to write to USB drive.');
});

test('clicking "Update Date and Time" shows modal to set clock', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2020-10-31T00:00:00.000Z'));
  window.kiosk = fakeKiosk();

  renderScreen();

  screen.getByRole('heading', { name: 'Settings' });

  // We just do a simple happy path test here, since the libs/ui/set_clock unit
  // tests cover full behavior
  userEvent.click(screen.getByRole('button', { name: 'Update Date and Time' }));

  // Open modal
  const modal = screen.getByRole('alertdialog');
  within(modal).getByText('Sat, Oct 31, 2020, 12:00 AM');

  // Change date
  const selectYear = screen.getByTestId('selectYear');
  userEvent.selectOptions(selectYear, '2025');

  // Save date
  mockApiClient.logOut.expectCallWith().resolves();
  userEvent.click(within(modal).getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(window.kiosk?.setClock).toHaveBeenCalledWith({
      isoDatetime: '2025-10-31T00:00:00.000+00:00',
      // eslint-disable-next-line vx/gts-identifiers
      IANAZone: 'UTC',
    });
  });

  jest.useRealTimers();
});