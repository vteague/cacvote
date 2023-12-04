import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@votingworks/utils';

import { scanBallot, withApp } from '../test/helpers/custom_helpers';
import { configureApp } from '../test/helpers/shared_helpers';

const mockFeatureFlagger = getFeatureFlagMock();

jest.mock('@votingworks/utils', (): typeof import('@votingworks/utils') => {
  return {
    ...jest.requireActual('@votingworks/utils'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

beforeEach(() => {
  mockFeatureFlagger.resetFeatureFlags();
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('getUsbDriveStatus', async () => {
  await withApp({}, async ({ apiClient, mockUsbDrive }) => {
    mockUsbDrive.removeUsbDrive();
    await expect(apiClient.getUsbDriveStatus()).resolves.toEqual({
      status: 'no_drive',
    });
    mockUsbDrive.insertUsbDrive({});
    await expect(apiClient.getUsbDriveStatus()).resolves.toEqual({
      status: 'mounted',
      mountPoint: expect.any(String),
    });
  });
});

test('ejectUsbDrive', async () => {
  await withApp({}, async ({ apiClient, mockUsbDrive }) => {
    mockUsbDrive.usbDrive.eject.expectCallWith('unknown').resolves();
    await expect(apiClient.ejectUsbDrive()).resolves.toBeUndefined();
  });
});

test('doesUsbDriveRequireCastVoteRecordSync is properly populated', async () => {
  await withApp(
    {},
    async ({ apiClient, mockAuth, mockUsbDrive, mockScanner, workspace }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive, { testMode: true });
      const mountedUsbDriveStatus = {
        status: 'mounted',
        mountPoint: expect.any(String),
      } as const;

      await expect(apiClient.getUsbDriveStatus()).resolves.toEqual(
        mountedUsbDriveStatus
      );

      await scanBallot(mockScanner, apiClient, workspace.store, 0);
      await expect(apiClient.getUsbDriveStatus()).resolves.toEqual(
        mountedUsbDriveStatus
      );

      mockUsbDrive.removeUsbDrive();
      await expect(apiClient.getUsbDriveStatus()).resolves.toEqual({
        status: 'no_drive',
      });

      // Insert an empty USB drive and ensure that we detect that it requires a cast vote record
      // sync
      mockUsbDrive.insertUsbDrive({});
      await expect(apiClient.getUsbDriveStatus()).resolves.toEqual({
        ...mountedUsbDriveStatus,
        doesUsbDriveRequireCastVoteRecordSync: true,
      });
    }
  );
});
