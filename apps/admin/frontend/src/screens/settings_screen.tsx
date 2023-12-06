import React, { useContext } from 'react';
import {
  CurrentDateAndTime,
  ExportLogsButton,
  H2,
  P,
  RebootToBiosButton,
  SetClockButton,
} from '@votingworks/ui';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isSystemAdministratorAuth,
} from '@votingworks/utils';

import type { LogsResultType } from '@votingworks/backend';
import { err } from '@votingworks/basics';
import { AppContext } from '../contexts/app_context';
import { NavigationScreen } from '../components/navigation_screen';
import { FormatUsbButton } from '../components/format_usb_modal';
import { exportLogsToUsb, logOut } from '../api';
import { LiveCheckButton } from '../components/live_check_button';

export function SettingsScreen(): JSX.Element {
  const { auth, logger, usbDriveStatus } = useContext(AppContext);
  const logOutMutation = logOut.useMutation();
  const exportLogsToUsbMutation = exportLogsToUsb.useMutation();

  async function doExportLogs(): Promise<LogsResultType> {
    try {
      return await exportLogsToUsbMutation.mutateAsync();
    } catch (e) {
      return err('copy-failed');
    }
  }

  return (
    <NavigationScreen title="Settings">
      <H2>Date and Time</H2>
      <P>
        <CurrentDateAndTime />
      </P>
      <P>
        <SetClockButton logOut={() => logOutMutation.mutate()}>
          Set Date and Time
        </SetClockButton>
      </P>
      {isSystemAdministratorAuth(auth) && (
        <React.Fragment>
          <H2>Logs</H2>
          <ExportLogsButton
            usbDriveStatus={usbDriveStatus}
            auth={auth}
            logger={logger}
            onExportLogs={doExportLogs}
          />
          <H2>USB Formatting</H2>
          <FormatUsbButton />
          <H2>Software Update</H2>
          <RebootToBiosButton logger={logger} />
        </React.Fragment>
      )}
      {isFeatureFlagEnabled(BooleanEnvironmentVariableName.LIVECHECK) && (
        <React.Fragment>
          <H2>Live Check</H2>
          <P>
            <LiveCheckButton />
          </P>
        </React.Fragment>
      )}
    </NavigationScreen>
  );
}
