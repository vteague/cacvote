import { InsertedSmartCardAuthApi } from '@votingworks/auth';
import { ok } from '@votingworks/basics';
import { mockBallotPackageFileTree } from '@votingworks/backend';
import { electionFamousNames2021Fixtures } from '@votingworks/fixtures';
import * as grout from '@votingworks/grout';
import {
  fakeElectionManagerUser,
  fakeSessionExpiresAt,
  mockOf,
} from '@votingworks/test-utils';
import {
  BallotPackage,
  PrecinctId,
  PrecinctScannerState,
} from '@votingworks/types';
import {
  ALL_PRECINCTS_SELECTION,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import waitForExpect from 'wait-for-expect';
import { MockUsbDrive } from '@votingworks/usb-drive';
import { Api } from '../../src/app';
import { PrecinctScannerStatus } from '../../src/types';
import { Store } from '../../src/store';

export async function expectStatus(
  apiClient: grout.Client<Api>,
  expectedStatus: {
    state: PrecinctScannerState;
  } & Partial<PrecinctScannerStatus>
): Promise<void> {
  const status = await apiClient.getScannerStatus();
  expect(status).toEqual({
    ballotsCounted: 0,
    error: undefined,
    interpretation: undefined,
    ...expectedStatus,
  });
}

export async function waitForStatus(
  apiClient: grout.Client<Api>,
  status: {
    state: PrecinctScannerState;
  } & Partial<PrecinctScannerStatus>
): Promise<void> {
  await waitForExpect(async () => {
    await expectStatus(apiClient, status);
  }, 2_000);
}

/**
 * configureApp is a testing convenience function that handles some common configuration of the VxScan app.
 * @param apiClient - a VxScan API client
 * @param mockAuth - a mock InsertedSmartCardAuthApi
 * @param mockUsbDrive - a mock USB drive
 * @param options - an object containing optional arguments
 */
export async function configureApp(
  apiClient: grout.Client<Api>,
  mockAuth: InsertedSmartCardAuthApi,
  mockUsbDrive: MockUsbDrive,
  {
    ballotPackage = electionFamousNames2021Fixtures.electionJson.toBallotPackage(),
    precinctId,
    testMode = false,
  }: {
    ballotPackage?: BallotPackage;
    precinctId?: PrecinctId;
    testMode?: boolean;
  } = {}
): Promise<void> {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: fakeElectionManagerUser(ballotPackage.electionDefinition),
      sessionExpiresAt: fakeSessionExpiresAt(),
    })
  );

  mockUsbDrive.insertUsbDrive(await mockBallotPackageFileTree(ballotPackage));

  expect(await apiClient.configureFromBallotPackageOnUsbDrive()).toEqual(ok());

  await apiClient.setPrecinctSelection({
    precinctSelection: precinctId
      ? singlePrecinctSelectionFor(precinctId)
      : ALL_PRECINCTS_SELECTION,
  });
  await apiClient.setTestMode({ isTestMode: testMode });
  await apiClient.setPollsState({ pollsState: 'polls_open' });
}

/**
 * Continuous export to USB drive happens in the background as ballots are scanned. Ending a test
 * before continuous export finishes can result in errors due to directories getting cleaned up
 * while they're still being read from / written to.
 */
export async function waitForContinuousExportToUsbDrive(
  store: Store
): Promise<void> {
  await waitForExpect(
    () => expect(store.isContinuousExportOperationInProgress()).toEqual(false),
    10000,
    250
  );
}
