import { assert } from '@votingworks/basics';
import {
  electionFamousNames2021Fixtures,
  systemSettings,
  electionTwoPartyPrimaryFixtures,
} from '@votingworks/fixtures';
import {
  fakeElectionManagerUser,
  fakeSessionExpiresAt,
  mockOf,
  suppressingConsoleOutput,
} from '@votingworks/test-utils';
import { InsertedSmartCardAuthApi } from '@votingworks/auth';
import {
  BALLOT_PACKAGE_FOLDER,
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import { Buffer } from 'buffer';
import { mockBallotPackageFileTree } from '@votingworks/backend';
import { Server } from 'http';
import * as grout from '@votingworks/grout';
import {
  DEFAULT_SYSTEM_SETTINGS,
  ElectionDefinition,
  SinglePrecinctSelection,
  safeParseSystemSettings,
} from '@votingworks/types';
import { MockUsbDrive } from '@votingworks/usb-drive';
import { createApp } from '../test/app_helpers';
import { Api } from './app';
import { PaperHandlerStateMachine } from './custom-paper-handler';

const featureFlagMock = getFeatureFlagMock();
jest.mock('@votingworks/utils', (): typeof import('@votingworks/utils') => {
  return {
    ...jest.requireActual('@votingworks/utils'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

let apiClient: grout.Client<Api>;
let mockAuth: InsertedSmartCardAuthApi;
let mockUsbDrive: MockUsbDrive;
let server: Server;
let stateMachine: PaperHandlerStateMachine;

beforeEach(async () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_BALLOT_PACKAGE_AUTHENTICATION
  );

  const result = await createApp();
  apiClient = result.apiClient;
  mockAuth = result.mockAuth;
  mockUsbDrive = result.mockUsbDrive;
  server = result.server;
  stateMachine = result.stateMachine;
});

afterEach(() => {
  stateMachine.stopMachineService();
  server?.close();
  jest.resetAllMocks();
});

async function setUpUsbAndConfigureElection(
  electionDefinition: ElectionDefinition
) {
  mockUsbDrive.insertUsbDrive(
    await mockBallotPackageFileTree({
      electionDefinition,
      systemSettings: safeParseSystemSettings(
        systemSettings.asText()
      ).unsafeUnwrap(),
    })
  );

  const writeResult = await apiClient.configureBallotPackageFromUsb();
  assert(writeResult.isOk());
}

function mockElectionManagerAuth(electionDefinition: ElectionDefinition) {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: fakeElectionManagerUser(electionDefinition),
      sessionExpiresAt: fakeSessionExpiresAt(),
    })
  );
}

test('uses machine config from env', async () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    VX_MACHINE_ID: 'test-machine-id',
    VX_CODE_VERSION: 'test-code-version',
    VX_SCREEN_ORIENTATION: 'landscape',
  };

  expect(await apiClient.getMachineConfig()).toEqual({
    machineId: 'test-machine-id',
    codeVersion: 'test-code-version',
    screenOrientation: 'landscape',
  });

  process.env = originalEnv;
});

test('uses default machine config if not set', async () => {
  expect(await apiClient.getMachineConfig()).toEqual({
    machineId: '0000',
    codeVersion: 'dev',
    screenOrientation: 'portrait',
  });
});

test('precinct selection can be written/read to/from store', async () => {
  const { electionDefinition } = electionFamousNames2021Fixtures;
  mockElectionManagerAuth(electionDefinition);
  await setUpUsbAndConfigureElection(electionDefinition);

  let precinctSelectionFromStore = await apiClient.getPrecinctSelection();
  expect(precinctSelectionFromStore).toBeUndefined();

  const precinct = electionDefinition.election.precincts[0].id;
  const precinctSelection = singlePrecinctSelectionFor(precinct);
  await apiClient.setPrecinctSelection({
    precinctSelection,
  });

  precinctSelectionFromStore = await apiClient.getPrecinctSelection();
  expect(precinctSelectionFromStore).toEqual(precinctSelection);
});

test('configureBallotPackageFromUsb reads to and writes from store', async () => {
  const { electionDefinition } = electionFamousNames2021Fixtures;

  mockElectionManagerAuth(electionDefinition);
  await setUpUsbAndConfigureElection(electionDefinition);

  const readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(
    safeParseSystemSettings(systemSettings.asText()).unsafeUnwrap()
  );
  const electionDefinitionResult = await apiClient.getElectionDefinition();
  expect(electionDefinitionResult).toEqual(electionDefinition);
});

test('configureBallotPackageFromUsb automatically writes precinct selection if only 1 option', async () => {
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.singlePrecinctElectionDefinition;
  assert(
    electionDefinition.election.precincts.length === 1,
    'Expected election to have exactly 1 precinct'
  );

  mockElectionManagerAuth(electionDefinition);
  await setUpUsbAndConfigureElection(electionDefinition);

  const precinctSelection = await apiClient.getPrecinctSelection();
  assert(precinctSelection, 'Expected precinct selection to be defined');
  expect((precinctSelection as SinglePrecinctSelection).precinctId).toEqual(
    electionDefinition.election.precincts[0].id
  );
});

test('configureBallotPackageFromUsb does not automatically write precinct selection if > 1 option', async () => {
  const { electionDefinition } = electionFamousNames2021Fixtures;
  assert(
    electionDefinition.election.precincts.length > 1,
    'Expected election to have > 1 precinct'
  );

  mockElectionManagerAuth(electionDefinition);
  await setUpUsbAndConfigureElection(electionDefinition);

  const precinctSelection = await apiClient.getPrecinctSelection();
  expect(precinctSelection).toBeUndefined();
});

test('unconfigureMachine deletes system settings and election definition', async () => {
  const { electionDefinition } = electionFamousNames2021Fixtures;

  mockElectionManagerAuth(electionDefinition);
  mockElectionManagerAuth(electionDefinition);
  let readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(
    safeParseSystemSettings(systemSettings.asText()).unsafeUnwrap()
  );

  await setUpUsbAndConfigureElection(electionDefinition);
  await apiClient.unconfigureMachine();

  readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(DEFAULT_SYSTEM_SETTINGS);
  const electionDefinitionResult = await apiClient.getElectionDefinition();
  expect(electionDefinitionResult).toBeNull();
});

test('configureBallotPackageFromUsb throws when no USB drive mounted', async () => {
  const { electionDefinition } = electionFamousNames2021Fixtures;
  mockElectionManagerAuth(electionDefinition);

  mockUsbDrive.usbDrive.status
    .expectCallWith()
    .resolves({ status: 'no_drive' });
  await suppressingConsoleOutput(async () => {
    await expect(apiClient.configureBallotPackageFromUsb()).rejects.toThrow(
      'No USB drive mounted'
    );
  });
});

test('configureBallotPackageFromUsb returns an error if ballot package parsing fails', async () => {
  // Lack of auth will cause ballot package reading to throw
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_out',
      reason: 'no_card',
    })
  );

  mockUsbDrive.insertUsbDrive({
    'some-election': {
      [BALLOT_PACKAGE_FOLDER]: {
        'test-ballot-package.zip': Buffer.from("doesn't matter"),
      },
    },
  });

  const result = await apiClient.configureBallotPackageFromUsb();
  assert(result.isErr());
  expect(result.err()).toEqual('auth_required_before_ballot_package_load');
});

test('usbDrive', async () => {
  const { usbDrive } = mockUsbDrive;

  usbDrive.status.expectCallWith().resolves({ status: 'no_drive' });
  expect(await apiClient.getUsbDriveStatus()).toEqual({
    status: 'no_drive',
  });

  usbDrive.eject.expectCallWith('unknown').resolves();
  await apiClient.ejectUsbDrive();

  mockElectionManagerAuth(electionFamousNames2021Fixtures.electionDefinition);
  usbDrive.eject.expectCallWith('election_manager').resolves();
  await apiClient.ejectUsbDrive();
});
