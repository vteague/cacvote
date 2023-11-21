import * as grout from '@votingworks/grout';
import { useDevDockRouter } from '@votingworks/dev-dock-backend';
import { LogEventId, Logger } from '@votingworks/logging';
import {
  BallotPackageConfigurationError,
  DEFAULT_SYSTEM_SETTINGS,
  ExportCastVoteRecordsToUsbDriveError,
  PrecinctSelection,
  SinglePrecinctSelection,
  Tabulation,
} from '@votingworks/types';
import {
  getPollsTransitionDestinationState,
  isElectionManagerAuth,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import express, { Application } from 'express';
import {
  createUiStringsApi,
  createLogsApi,
  readBallotPackageFromUsb,
  exportCastVoteRecordsToUsbDrive,
  doesUsbDriveRequireCastVoteRecordSync as doesUsbDriveRequireCastVoteRecordSyncFn,
  configureUiStrings,
} from '@votingworks/backend';
import {
  assert,
  assertDefined,
  ok,
  Result,
  throwIllegalValue,
} from '@votingworks/basics';
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
  PollsTransition,
  PrecinctScannerPollsInfo,
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

  async function getUserRole() {
    const authStatus = await auth.getAuthStatus(
      constructAuthMachineState(workspace)
    );
    if (authStatus.status === 'logged_in') {
      return authStatus.user.role;
    }
    return undefined;
  }

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

      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace)
      );
      const ballotPackageResult = await readBallotPackageFromUsb(
        authStatus,
        usbDrive,
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
        ballotCountWhenBallotBagLastReplaced:
          store.getBallotCountWhenBallotBagLastReplaced(),
      };
    },

    getPollsInfo(): PrecinctScannerPollsInfo {
      const pollsState = store.getPollsState();
      if (pollsState === 'polls_closed_initial') {
        return {
          pollsState,
        };
      }

      return {
        pollsState,
        lastPollsTransition: assertDefined(store.getLastPollsTransition()),
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

    async transitionPolls(
      input: Omit<PollsTransition, 'ballotCount'>
    ): Promise<void> {
      const previousPollsState = store.getPollsState();
      const newPollsState = getPollsTransitionDestinationState(input.type);

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

      store.transitionPolls(input);
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
      const userRole = (await getUserRole()) ?? 'system';
      await logger.log(LogEventId.ExportCastVoteRecordsInit, userRole, {
        message:
          input.mode === 'polls_closing'
            ? 'Marking cast vote record export as complete on polls close...'
            : 'Exporting cast vote records...',
      });
      let exportResult: Result<void, ExportCastVoteRecordsToUsbDriveError>;
      switch (input.mode) {
        case 'full_export': {
          exportResult = await exportCastVoteRecordsToUsbDrive(
            store,
            usbDrive,
            store.forEachSheet(),
            { scannerType: 'precinct', isFullExport: true }
          );
          break;
        }
        case 'polls_closing': {
          exportResult = await exportCastVoteRecordsToUsbDrive(
            store,
            usbDrive,
            [],
            { scannerType: 'precinct', arePollsClosing: true }
          );
          break;
        }
        /* c8 ignore start: Compile-time check for completeness */
        default: {
          throwIllegalValue(input.mode);
        }
        /* c8 ignore stop */
      }
      if (exportResult.isErr()) {
        await logger.log(LogEventId.ExportCastVoteRecordsComplete, userRole, {
          disposition: 'failure',
          message:
            input.mode === 'polls_closing'
              ? 'Error marking cast vote record export as complete on polls close.'
              : 'Error exporting cast vote records.',
          errorDetails: JSON.stringify(exportResult.err()),
        });
      } else {
        await logger.log(LogEventId.ExportCastVoteRecordsComplete, userRole, {
          disposition: 'success',
          message:
            input.mode === 'polls_closing'
              ? 'Successfully marked cast vote record export as complete on polls close.'
              : 'Successfully exported cast vote records.',
        });
      }
      return exportResult;
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

    ...createLogsApi({ usbDrive, machineId: getMachineConfig().machineId }),
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
