import userEvent from '@testing-library/user-event';
import {
  fakeElectionManagerUser,
  fakeSessionExpiresAt,
  fakeSystemAdministratorUser,
} from '@votingworks/test-utils';
import {
  ElectionManagerLoggedIn,
  SystemAdministratorLoggedIn,
} from '@votingworks/types/src/auth/dipped_smart_card_auth';
import { mockUsbDriveStatus } from '@votingworks/ui';
import { ok } from '@votingworks/basics';
import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '../../test/react_testing_library';

import {
  eitherNeitherElectionDefinition,
  renderInAppContext,
} from '../../test/render_in_app_context';
import { SettingsScreen } from './settings_screen';
import { ApiMock, createApiMock } from '../../test/helpers/mock_api_client';

let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2022-06-22T00:00:00.000Z'));
  apiMock = createApiMock();
});

afterEach(() => {
  jest.useRealTimers();
  apiMock.assertComplete();
});

describe('as System Admin', () => {
  const auth: SystemAdministratorLoggedIn = {
    status: 'logged_in',
    user: fakeSystemAdministratorUser(),
    sessionExpiresAt: fakeSessionExpiresAt(),
    programmableCard: { status: 'no_card' },
  };

  test('Setting current date and time', async () => {
    renderInAppContext(<SettingsScreen />, { apiMock, auth });

    screen.getByRole('heading', { name: 'Date and Time' });

    // Clock setting is tested fully in libs/ui/src/set_clock.test.tsx
    userEvent.click(screen.getByRole('button', { name: 'Set Date and Time' }));
    const modal = screen.getByRole('alertdialog');
    within(modal).getByText('Wed, Jun 22, 2022, 12:00 AM UTC');
    userEvent.selectOptions(within(modal).getByTestId('selectYear'), '2023');
    apiMock.apiClient.setClock
      .expectCallWith({
        isoDatetime: '2023-06-22T00:00:00.000+00:00',
        ianaZone: 'UTC',
      })
      .resolves();
    apiMock.expectLogOut();
    userEvent.click(within(modal).getByRole('button', { name: 'Save' }));
    await waitForElementToBeRemoved(screen.queryByRole('alertdialog'));
  });

  test('Rebooting to BIOS', () => {
    renderInAppContext(<SettingsScreen />, { apiMock, auth });

    screen.getByRole('heading', { name: 'Software Update' });

    // Rebooting to BIOS is tested in libs/ui/src/reboot_to_bios_button.test.tsx
    screen.getByText('Reboot to BIOS');
  });

  test('Exporting logs', async () => {
    renderInAppContext(<SettingsScreen />, {
      apiMock,
      auth,
      usbDriveStatus: mockUsbDriveStatus('mounted'),
    });

    apiMock.apiClient.exportLogsToUsb.expectCallWith().resolves(ok());

    // Log saving is tested fully in src/components/export_logs_modal.test.tsx
    userEvent.click(screen.getButton('Save Log File'));
    await screen.findByText('Save logs on the inserted USB drive?');
    userEvent.click(screen.getButton('Save'));
    userEvent.click(await screen.findButton('Close'));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  });
});

describe('as Election Manager', () => {
  const auth: ElectionManagerLoggedIn = {
    status: 'logged_in',
    user: fakeElectionManagerUser({
      electionHash: eitherNeitherElectionDefinition.electionHash,
    }),
    sessionExpiresAt: fakeSessionExpiresAt(),
  };

  test('Date and time', () => {
    renderInAppContext(<SettingsScreen />, { apiMock, auth });
    screen.getByRole('heading', { name: 'Date and Time' });
    userEvent.click(screen.getByRole('button', { name: 'Set Date and Time' }));
    userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // Clock setting is tested fully in libs/ui/src/set_clock.test.tsx

    // Shouldn't have System-Admin-only sections
    expect(
      screen.queryByRole('heading', { name: 'Software Update' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'USB Formatting' })
    ).not.toBeInTheDocument();
  });

  test('Exporting logs', async () => {
    renderInAppContext(<SettingsScreen />, {
      apiMock,
      auth,
      usbDriveStatus: mockUsbDriveStatus('mounted'),
    });

    apiMock.apiClient.exportLogsToUsb.expectCallWith().resolves(ok());

    // Log saving is tested fully in src/components/export_logs_modal.test.tsx
    userEvent.click(screen.getButton('Save Log File'));
    await screen.findByText('Save logs on the inserted USB drive?');
    userEvent.click(screen.getButton('Save'));
    userEvent.click(await screen.findButton('Close'));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  });
});
