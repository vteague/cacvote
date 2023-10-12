import { fakeKiosk } from '@votingworks/test-utils';
import { Logger, LogSource } from '@votingworks/logging';
import { deferred } from '@votingworks/basics';
import { fireEvent, render, screen } from '../test/react_testing_library';
import { RebootFromUsbButton } from './reboot_from_usb_button';
import { mockUsbDriveStatus } from './test-utils/mock_usb_drive';

beforeEach(() => {
  window.kiosk = fakeKiosk();
});

test('renders without a USB drive as expected.', async () => {
  render(
    <RebootFromUsbButton
      usbDriveStatus={mockUsbDriveStatus('no_drive')}
      logger={new Logger(LogSource.VxAdminFrontend)}
    />
  );
  // Initially should just contain the button
  fireEvent.click(screen.getByText('Reboot from USB'));
  await screen.findByText('No USB Drive Detected');
});

test('renders with a non-bootable USB as expected', async () => {
  window.kiosk!.prepareToBootFromUsb = jest.fn().mockResolvedValue(false);
  render(
    <RebootFromUsbButton
      usbDriveStatus={mockUsbDriveStatus('mounted')}
      logger={new Logger(LogSource.VxAdminFrontend)}
    />
  );
  fireEvent.click(screen.getByText('Reboot from USB'));
  await screen.findByText(
    /The USB Drive was not found in the list of bootable devices./
  );
  expect(window.kiosk!.prepareToBootFromUsb).toHaveBeenCalledTimes(1);
  expect(window.kiosk!.reboot).toHaveBeenCalledTimes(0);
  fireEvent.click(screen.getByText('Close'));
  expect(
    screen.queryAllByText(
      /The USB Drive was not found in the list of bootable devices./
    )
  ).toHaveLength(0);
  fireEvent.click(screen.getByText('Reboot from USB'));
  await screen.findByText(
    /The USB Drive was not found in the list of bootable devices./
  );
  fireEvent.click(screen.getByText('Reboot'));
  await screen.findByText('Rebooting…');
  expect(window.kiosk!.reboot).toHaveBeenCalledTimes(1);
});

test('reboots automatically when clicked with a bootable USB', async () => {
  window.kiosk!.prepareToBootFromUsb = jest.fn().mockResolvedValue(true);
  render(
    <RebootFromUsbButton
      usbDriveStatus={mockUsbDriveStatus('mounted')}
      logger={new Logger(LogSource.VxAdminFrontend)}
    />
  );
  fireEvent.click(screen.getByText('Reboot from USB'));
  await screen.findByText('Rebooting…');
  expect(window.kiosk!.prepareToBootFromUsb).toHaveBeenCalledTimes(1);
  expect(window.kiosk!.reboot).toHaveBeenCalledTimes(1);
});

test('modal state updates when USB drive is inserted.', async () => {
  window.kiosk!.prepareToBootFromUsb = jest.fn().mockResolvedValue(false);
  const { rerender } = render(
    <RebootFromUsbButton
      usbDriveStatus={mockUsbDriveStatus('no_drive')}
      logger={new Logger(LogSource.VxAdminFrontend)}
    />
  );
  fireEvent.click(screen.getByText('Reboot from USB'));
  await screen.findByText('No USB Drive Detected');
  rerender(
    <RebootFromUsbButton
      usbDriveStatus={mockUsbDriveStatus('mounted')}
      logger={new Logger(LogSource.VxAdminFrontend)}
    />
  );
  await screen.findByText(/The USB Drive was not found/);
  expect(window.kiosk!.prepareToBootFromUsb).toHaveBeenCalledTimes(1);
  expect(window.kiosk!.reboot).toHaveBeenCalledTimes(0);
});

test('shows message when preparing usb', async () => {
  const { promise: preparePromise } = deferred<void>();
  window.kiosk!.prepareToBootFromUsb = jest
    .fn()
    .mockReturnValueOnce(preparePromise);
  render(
    <RebootFromUsbButton
      usbDriveStatus={mockUsbDriveStatus('mounted')}
      logger={new Logger(LogSource.VxAdminFrontend)}
    />
  );
  fireEvent.click(screen.getByText('Reboot from USB'));
  await screen.findByText('Preparing to boot…');
});
