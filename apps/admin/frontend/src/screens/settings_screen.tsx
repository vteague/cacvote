import React, { useContext } from 'react';
import {
  CurrentDateAndTime,
  H2,
  P,
  RebootFromUsbButton,
  RebootToBiosButton,
  SetClockButton,
} from '@votingworks/ui';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isSystemAdministratorAuth,
} from '@votingworks/utils';

import { AppContext } from '../contexts/app_context';
import { NavigationScreen } from '../components/navigation_screen';
import { FormatUsbButton } from '../components/format_usb_modal';
import { logOut } from '../api';
import { LiveCheckButton } from '../components/live_check_button';

export function SettingsScreen(): JSX.Element {
  const { auth, logger, usbDriveStatus } = useContext(AppContext);
  const logOutMutation = logOut.useMutation();

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
          <H2>USB Formatting</H2>
          <FormatUsbButton />
          <H2>Software Update</H2>
          <P>
            <RebootFromUsbButton
              logger={logger}
              usbDriveStatus={usbDriveStatus}
            />{' '}
            <RebootToBiosButton logger={logger} />
          </P>
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
