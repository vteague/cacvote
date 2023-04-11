import * as grout from '@votingworks/grout';
import { LogEventId, Logger } from '@votingworks/logging';
import {
  BallotPackageConfigurationError,
  CastVoteRecord,
  MarkThresholds,
  PollsState,
  PrecinctSelection,
  SinglePrecinctSelection,
} from '@votingworks/types';
import {
  ScannerReportData,
  ScannerReportDataSchema,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import express, { Application } from 'express';
import {
  ExportDataError,
  exportCastVoteRecordReportToUsbDrive,
  ExportCastVoteRecordReportToUsbDriveError,
  readBallotPackageFromUsb,
} from '@votingworks/backend';
import { assert, err, ok, Result } from '@votingworks/basics';
import {
  DEV_JURISDICTION,
  InsertedSmartCardAuthApi,
  InsertedSmartCardAuthMachineState,
} from '@votingworks/auth';
import { backupToUsbDrive } from './backup';
import {
  exportCastVoteRecords,
  exportCastVoteRecordsToUsbDrive,
} from './cvrs/export';
import { PrecinctScannerInterpreter } from './interpret';
import {
  PrecinctScannerStateMachine,
  PrecinctScannerConfig,
  PrecinctScannerStatus,
} from './types';
import { Workspace } from './util/workspace';
import { Usb } from './util/usb';
import { getMachineConfig } from './machine_config';
import { CVR_EXPORT_FORMAT } from './globals';
import { DefaultMarkThresholds } from './store';

function constructAuthMachineState(
  workspace: Workspace
): InsertedSmartCardAuthMachineState {
  const electionDefinition = workspace.store.getElectionDefinition();
  return {
    electionHash: electionDefinition?.electionHash,
    // TODO: Persist jurisdiction in store and pull from there
    jurisdiction: DEV_JURISDICTION,
  };
}

function buildApi(
  auth: InsertedSmartCardAuthApi,
  machine: PrecinctScannerStateMachine,
  interpreter: PrecinctScannerInterpreter,
  workspace: Workspace,
  usb: Usb,
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

    async configureFromBallotPackageOnUsbDrive(): Promise<
      Result<void, BallotPackageConfigurationError>
    > {
      assert(!store.getElectionDefinition(), 'Already configured');
      const [usbDrive] = await usb.getUsbDrives();
      assert(usbDrive?.mountPoint !== undefined, 'No USB drive mounted');

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

      const ballotPackage = ballotPackageResult.ok();
      const { electionDefinition, systemSettings, ballots } = ballotPackage;
      assert(systemSettings);

      let precinctSelection: SinglePrecinctSelection | undefined;
      if (electionDefinition.election.precincts.length === 1) {
        precinctSelection = singlePrecinctSelectionFor(
          electionDefinition.election.precincts[0].id
        );
      }

      await store.withTransaction(async () => {
        store.setElection(electionDefinition.electionData);
        if (precinctSelection) {
          store.setPrecinctSelection(precinctSelection);
        }
        store.setSystemSettings(systemSettings);
        await store.setHmpbTemplates(ballots);
      });

      return ok();
    },

    getConfig(): PrecinctScannerConfig {
      return {
        electionDefinition: store.getElectionDefinition(),
        systemSettings: store.getSystemSettings(),
        precinctSelection: store.getPrecinctSelection(),
        markThresholdOverrides: store.getMarkThresholdOverrides(),
        isSoundMuted: store.getIsSoundMuted(),
        isTestMode: store.getTestMode(),
        pollsState: store.getPollsState(),
        ballotCountWhenBallotBagLastReplaced:
          store.getBallotCountWhenBallotBagLastReplaced(),
      };
    },

    unconfigureElection(input: { ignoreBackupRequirement?: boolean }): void {
      assert(
        input.ignoreBackupRequirement || store.getCanUnconfigure(),
        'Attempt to unconfigure without backup'
      );
      interpreter.unconfigure();
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

    setMarkThresholdOverrides(input: {
      markThresholdOverrides?: MarkThresholds;
    }): void {
      store.setMarkThresholdOverrides(input.markThresholdOverrides);
    },

    setIsSoundMuted(input: { isSoundMuted: boolean }): void {
      store.setIsSoundMuted(input.isSoundMuted);
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

    async backupToUsbDrive(): Promise<Result<void, ExportDataError>> {
      return await backupToUsbDrive(store, usb);
    },

    async exportCastVoteRecordsToUsbDrive(): Promise<
      Result<void, ExportCastVoteRecordReportToUsbDriveError>
    > {
      if (CVR_EXPORT_FORMAT === 'cdf') {
        const electionDefinition = store.getElectionDefinition();
        assert(
          electionDefinition,
          'Cannot export CVRs without election definition'
        );

        const exportResult = await exportCastVoteRecordReportToUsbDrive({
          electionDefinition,
          isTestMode: store.getTestMode(),
          ballotsCounted: store.getBallotsCounted(),
          batchInfo: store.batchStatus(),
          getResultSheetGenerator: store.forEachResultSheet.bind(store),
          ballotPageLayoutsLookup: store.getBallotPageLayoutsLookup(),
          definiteMarkThreshold:
            store.getCurrentMarkThresholds()?.definite ??
            DefaultMarkThresholds.definite,
        });

        if (exportResult.isOk()) {
          store.setCvrsBackedUp();
        }

        return exportResult;
      }

      return await exportCastVoteRecordsToUsbDrive(
        store,
        usb,
        getMachineConfig().machineId
      );
    },

    /**
     * @deprecated We want to eventually build the tally in the backend,
     * but for now that logic still lives in the frontend.
     */
    async getCastVoteRecordsForTally(): Promise<CastVoteRecord[]> {
      const castVoteRecords: CastVoteRecord[] = [];
      for await (const castVoteRecord of exportCastVoteRecords({
        store,
        skipImages: true,
      })) {
        castVoteRecords.push(castVoteRecord);
      }
      return castVoteRecords;
    },

    getScannerStatus(): PrecinctScannerStatus {
      const machineStatus = machine.status();
      const ballotsCounted = store.getBallotsCounted();
      const canUnconfigure = store.getCanUnconfigure();
      return {
        ...machineStatus,
        ballotsCounted,
        canUnconfigure,
      };
    },

    async scanBallot(): Promise<void> {
      assert(store.getPollsState() === 'polls_open');
      const electionDefinition = store.getElectionDefinition();
      const precinctSelection = store.getPrecinctSelection();
      const layouts = await store.loadLayouts();
      assert(electionDefinition);
      assert(precinctSelection);
      assert(layouts);
      interpreter.configure({
        electionDefinition,
        precinctSelection,
        layouts,
        testMode: store.getTestMode(),
        markThresholdOverrides: store.getMarkThresholdOverrides(),
        ballotImagesPath: workspace.ballotImagesPath,
      });
      machine.scan();
    },

    acceptBallot(): void {
      machine.accept();
    },

    returnBallot(): void {
      machine.return();
    },

    supportsCalibration(): boolean {
      return typeof machine.calibrate === 'function';
    },

    async calibrate(): Promise<boolean> {
      const result = await machine.calibrate?.();
      return result?.isOk() ?? false;
    },

    async saveScannerReportDataToCard(input: {
      scannerReportData: ScannerReportData;
    }): Promise<Result<void, Error>> {
      const machineState = constructAuthMachineState(workspace);
      const authStatus = await auth.getAuthStatus(machineState);
      if (authStatus.status !== 'logged_in') {
        return err(new Error('User is not logged in'));
      }
      if (authStatus.user.role !== 'poll_worker') {
        return err(new Error('User is not a poll worker'));
      }

      return await auth.writeCardData(machineState, {
        data: input.scannerReportData,
        schema: ScannerReportDataSchema,
      });
    },
  });
}

export type Api = ReturnType<typeof buildApi>;

export function buildApp(
  auth: InsertedSmartCardAuthApi,
  machine: PrecinctScannerStateMachine,
  interpreter: PrecinctScannerInterpreter,
  workspace: Workspace,
  usb: Usb,
  logger: Logger
): Application {
  const app: Application = express();
  const api = buildApi(auth, machine, interpreter, workspace, usb, logger);
  app.use('/api', grout.buildRouter(api, express));
  return app;
}
