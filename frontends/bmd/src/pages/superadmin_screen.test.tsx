import React from 'react';
import { fakeLogger } from '@votingworks/logging';
import { screen } from '@testing-library/react';
import { usbstick } from '@votingworks/utils';

import { render } from '../../test/test_utils';
import { SuperAdminScreen } from './superadmin_screen';

test('SuperAdminScreen renders expected contents', () => {
  const logger = fakeLogger();
  const unconfigureMachine = jest.fn();
  render(
    <SuperAdminScreen
      logger={logger}
      unconfigureMachine={unconfigureMachine}
      usbDriveStatus={usbstick.UsbDriveStatus.absent}
    />
  );

  // These buttons are further tested in libs/ui
  screen.getByRole('button', { name: 'Reboot from USB' });
  screen.getByRole('button', { name: 'Reboot to BIOS' });
  screen.getByRole('button', { name: 'Unconfigure Machine' });
});
