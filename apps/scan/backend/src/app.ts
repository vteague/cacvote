import * as grout from '@votingworks/grout';
import { useDevDockRouter } from '@votingworks/dev-dock-backend';
import { LogEventId, Logger } from '@votingworks/logging';
import {
  BallotPackageConfigurationError,
  DEFAULT_SYSTEM_SETTINGS,
  PollsState,
  PrecinctSelection,
  SinglePrecinctSelection,
  Tabulation,
} from '@votingworks/types';
import {
  isElectionManagerAuth,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import express, { Application } from 'express';
import {
  createUiStringsApi,
  readBallotPackageFromUsb,
  exportCastVoteRecordsToUsbDrive,
  doesUsbDriveRequireCastVoteRecordSync as doesUsbDriveRequireCastVoteRecordSyncFn,
  ExportCastVoteRecordsToUsbDriveError,
  configureUiStrings,
} from '@votingworks/backend';
import { assert, ok, Result, throwIllegalValue } from '@votingworks/basics';
import {
  InsertedSmartCardAuthApi,
  InsertedSmartCardAuthMachineState,
  LiveCheck,
} from '@votingworks/auth';
import { UsbDrive, UsbDriveStatus } from '@votingworks/usb-drive';
import {
  PrecinctScannerStateMachine,
  PrecinctScannerConfig,
  PrecinctScannerStatus,
} from './types';
import { Workspace } from './util/workspace';
import { getMachineConfig } from './machine_config';
import { getScannerResults } from './util/results';

function constructAuthMachineState(
  workspace: Workspace
): InsertedSmartCardAuthMachineState {
  const electionDefinition = workspace.store.getElectionDefinition();
  const jurisdiction = workspace.store.getJurisdiction();
  const systemSettings =
    workspace.store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS;
  return {
    ...systemSettings.auth,
    electionHash: electionDefinition?.electionHash,
    jurisdiction,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildApi(
  auth: InsertedSmartCardAuthApi,
  machine: PrecinctScannerStateMachine,
  workspace: Workspace,
  usbDrive: UsbDrive,
  logger: Logger
) {
  const { store } = workspace;

  return grout.createApi({
    getMachineConfig,

    getAuthStatus() {
      return auth.getAuthStatus(constructAuthMachineState(workspace));
    },

    checkPin(input: { pin: string }) {
      return auth.checkPin(constructAuthMachineState(workspace), input);
    },

    logOut() {
      return auth.logOut(constructAuthMachineState(workspace));
    },

    updateSessionExpiry(input: { sessionExpiresAt: Date }) {
      return auth.updateSessionExpiry(
        constructAuthMachineState(workspace),
        input
      );
    },

    generateLiveCheckQrCodeValue() {
      const { machineId } = getMachineConfig();
      const electionDefinition = workspace.store.getElectionDefinition();
      return new LiveCheck().generateQrCodeValue({
        machineId,
        electionHash: electionDefinition?.electionHash,
      });
    },

    async getUsbDriveStatus(): Promise<
      UsbDriveStatus & { doesUsbDriveRequireCastVoteRecordSync?: true }
    > {
      const usbDriveStatus = await usbDrive.status();
      return {
        ...usbDriveStatus,
        doesUsbDriveRequireCastVoteRecordSync:
          (await doesUsbDriveRequireCastVoteRecordSyncFn(
            store,
            usbDriveStatus
          )) || undefined,
      };
    },

    async ejectUsbDrive(): Promise<void> {
      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace)
      );
      return usbDrive.eject(
        authStatus.status === 'logged_in' ? authStatus.user.role : 'unknown'
      );
    },

    async configureFromBallotPackageOnUsbDrive(): Promise<
      Result<void, BallotPackageConfigurationError>
    > {
      assert(!store.getElectionDefinition(), 'Already configured');
      const usbDriveStatus = await usbDrive.status();
      assert(usbDriveStatus.status === 'mounted', 'No USB drive mounted');

      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace)
      );
      const ballotPackageResult = await readBallotPackageFromUsb(
        authStatus,
        // TODO: Update readBallotPackageFromUsb to use UsbDriveStatus
        { deviceName: 'not used', mountPoint: usbDriveStatus.mountPoint },
        logger
      );
      if (ballotPackageResult.isErr()) {
        return ballotPackageResult;
      }
      assert(isElectionManagerAuth(authStatus));
      const ballotPackage = ballotPackageResult.ok();
      const { electionDefinition, systemSettings } = ballotPackage;
      assert(systemSettings);
      let precinctSelection: SinglePrecinctSelection | undefined;
      if (electionDefinition.election.precincts.length === 1) {
        precinctSelection = singlePrecinctSelectionFor(
          electionDefinition.election.precincts[0].id
        );
      }

      store.withTransaction(() => {
        store.setElectionAndJurisdiction({
          electionData: electionDefinition.electionData,
          jurisdiction: authStatus.user.jurisdiction,
        });
        if (precinctSelection) {
          store.setPrecinctSelection(precinctSelection);
        }
        store.setSystemSettings(systemSettings);

        configureUiStrings({
          ballotPackage,
          logger,
          noAudio: true,
          store: workspace.store.getUiStringsStore(),
        });
      });

      return ok();
    },

    getConfig(): PrecinctScannerConfig {
      return {
        electionDefinition: store.getElectionDefinition(),
        systemSettings: store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS,
        precinctSelection: store.getPrecinctSelection(),
        isSoundMuted: store.getIsSoundMuted(),
        isTestMode: store.getTestMode(),
        isUltrasonicDisabled:
          !machine.supportsUltrasonic() || store.getIsUltrasonicDisabled(),
        pollsState: store.getPollsState(),
        ballotCountWhenBallotBagLastReplaced:
          store.getBallotCountWhenBallotBagLastReplaced(),
      };
    },

    unconfigureElection(): void {
      workspace.reset();
    },

    setPrecinctSelection(input: {
      precinctSelection: PrecinctSelection;
    }): void {
      assert(
        store.getBallotsCounted() === 0,
        'Attempt to change precinct selection after ballots have been cast'
      );
      store.setPrecinctSelection(input.precinctSelection);
      workspace.resetElectionSession();
    },

    setIsSoundMuted(input: { isSoundMuted: boolean }): void {
      store.setIsSoundMuted(input.isSoundMuted);
    },

    setIsUltrasonicDisabled(input: { isUltrasonicDisabled: boolean }): void {
      store.setIsUltrasonicDisabled(input.isUltrasonicDisabled);
    },

    setTestMode(input: { isTestMode: boolean }): void {
      workspace.resetElectionSession();
      store.setTestMode(input.isTestMode);
    },

    async setPollsState(input: { pollsState: PollsState }): Promise<void> {
      const previousPollsState = store.getPollsState();
      const newPollsState = input.pollsState;

      // Start new batch if opening polls, end batch if pausing or closing polls
      if (
        newPollsState === 'polls_open' &&
        previousPollsState !== 'polls_open'
      ) {
        const batchId = store.addBatch();
        await logger.log(LogEventId.ScannerBatchStarted, 'system', {
          disposition: 'success',
          message:
            'New scanning batch started due to polls being opened or voting being resumed.',
          batchId,
        });
      } else if (
        newPollsState !== 'polls_open' &&
        previousPollsState === 'polls_open'
      ) {
        const ongoingBatchId = store.getOngoingBatchId();
        assert(typeof ongoingBatchId === 'string');
        store.finishBatch({ batchId: ongoingBatchId });
        await logger.log(LogEventId.ScannerBatchEnded, 'system', {
          disposition: 'success',
          message:
            'Current scanning batch ended due to polls being closed or voting being paused.',
          batchId: ongoingBatchId,
        });
      }

      store.setPollsState(newPollsState);
    },

    async recordBallotBagReplaced(): Promise<void> {
      // If polls are open, we need to end current batch and start a new batch
      if (store.getPollsState() === 'polls_open') {
        const ongoingBatchId = store.getOngoingBatchId();
        assert(typeof ongoingBatchId === 'string');
        store.finishBatch({ batchId: ongoingBatchId });
        await logger.log(LogEventId.ScannerBatchEnded, 'system', {
          disposition: 'success',
          message:
            'Current scanning batch ended due to ballot bag replacement.',
          batchId: ongoingBatchId,
        });

        const batchId = store.addBatch();
        await logger.log(LogEventId.ScannerBatchStarted, 'system', {
          disposition: 'success',
          message: 'New scanning batch started due to ballot bag replacement.',
          batchId,
        });
      }

      store.setBallotCountWhenBallotBagLastReplaced(store.getBallotsCounted());
    },

    async exportCastVoteRecordsToUsbDrive(input: {
      mode: 'full_export' | 'polls_closing';
    }): Promise<Result<void, ExportCastVoteRecordsToUsbDriveError>> {
      switch (input.mode) {
        case 'full_export': {
          return exportCastVoteRecordsToUsbDrive(
            store,
            usbDrive,
            store.forEachSheet(),
            { scannerType: 'precinct', isFullExport: true }
          );
        }
        case 'polls_closing': {
          return exportCastVoteRecordsToUsbDrive(store, usbDrive, [], {
            scannerType: 'precinct',
            arePollsClosing: true,
          });
        }
        /* c8 ignore start: Compile-time check for completeness */
        default: {
          throwIllegalValue(input.mode);
        }
        /* c8 ignore stop */
      }
    },

    async getScannerResultsByParty(): Promise<
      Tabulation.GroupList<Tabulation.ElectionResults>
    > {
      const results = await getScannerResults({ store, splitByParty: true });
      return results;
    },

    getScannerStatus(): PrecinctScannerStatus {
      const machineStatus = machine.status();
      const ballotsCounted = store.getBallotsCounted();
      return {
        ...machineStatus,
        ballotsCounted,
      };
    },

    scanBallot(): void {
      assert(store.getPollsState() === 'polls_open');
      machine.scan();
    },

    acceptBallot(): void {
      machine.accept();
    },

    returnBallot(): void {
      machine.return();
    },

    supportsUltrasonic(): boolean {
      return machine.supportsUltrasonic();
    },

    ...createUiStringsApi({
      logger,
      store: workspace.store.getUiStringsStore(),
    }),
  });
}

export type Api = ReturnType<typeof buildApi>;

export function buildApp(
  auth: InsertedSmartCardAuthApi,
  machine: PrecinctScannerStateMachine,
  workspace: Workspace,
  usbDrive: UsbDrive,
  logger: Logger
): Application {
  const app: Application = express();
  const api = buildApi(auth, machine, workspace, usbDrive, logger);
  app.use('/api', grout.buildRouter(api, express));
  useDevDockRouter(app, express);
  return app;
}
