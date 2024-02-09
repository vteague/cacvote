import { screen } from '@testing-library/react';
import type {
  Api,
  BallotCountReportSpec,
  BallotCountReportWarning,
  CastVoteRecordFileMetadata,
  CastVoteRecordFileRecord,
  CvrFileMode,
  MachineConfig,
  ManualResultsIdentifier,
  ManualResultsMetadataRecord,
  WriteInCandidateRecord,
  WriteInAdjudicationContext,
  ScannerBatch,
  WriteInAdjudicationQueueMetadata,
  WriteInImageView,
  ExportDataError,
  TallyReportSpec,
  TallyReportWarning,
} from '@votingworks/admin-backend';
import { FileSystemEntry, FileSystemEntryType } from '@votingworks/backend';
import { Result, deferred, ok } from '@votingworks/basics';
import { createMockClient, MockClient } from '@votingworks/grout-test-utils';
import { Buffer } from 'buffer';
import {
  MockFunction,
  fakeElectionManagerUser,
  fakeSessionExpiresAt,
  fakeSystemAdministratorUser,
} from '@votingworks/test-utils';
import {
  Admin,
  ContestId,
  DEFAULT_SYSTEM_SETTINGS,
  DippedSmartCardAuth,
  ElectionDefinition,
  Id,
  Rect,
  SystemSettings,
  Tabulation,
} from '@votingworks/types';
import { mockUsbDriveStatus } from '@votingworks/ui';
import type { UsbDriveStatus } from '@votingworks/usb-drive';
import type { PrinterStatus } from '@votingworks/printing';

const mockRect: Rect = {
  width: 1000,
  height: 1000,
  x: 0,
  y: 0,
};

export type MockApiClient = MockClient<Api>;

export function createMockApiClient(): MockApiClient {
  return createMockClient<Api>();
}

/**
 * Takes an API client mock function and returns a function that can be used to
 * expect a call with a specific parameter and return a specific value, with
 * the option to defer the resolution. Useful for testing loading states.
 *
 * @example
 *
 * const { resolve } = expectPrintTallyReport({
 *  expectCallWith: reportSpec,
 *  returnValue: ok([]),
 *  defer: true,
 * })
 *
 * userEvent.click(screen.getButton('Print'));
 * await screen.findByText('Printing');
 * resolve();
 * await screen.findByText('Printed');
 */
function createDeferredMock<T, U>(
  fn: MockFunction<(callsWith: T) => Promise<U>>
): (params: { expectCallWith: T; returnValue: U; deferred?: boolean }) => {
  resolve: () => void;
} {
  return (params: {
    expectCallWith: T;
    returnValue: U;
    deferred?: boolean;
  }) => {
    const { promise, resolve } = deferred<U>();
    fn.expectCallWith(params.expectCallWith).returns(promise);

    if (!params.deferred) {
      resolve(params.returnValue);
    }

    return {
      resolve: () => {
        resolve(params.returnValue);
      },
    };
  };
}

/**
 * Creates a VxAdmin specific wrapper around commonly used methods from the Grout
 * mock API client to make it easier to use for our specific test needs
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createApiMock(
  apiClient: MockApiClient = createMockApiClient()
) {
  function setPrinterStatus(printerStatus: Partial<PrinterStatus>): void {
    apiClient.getPrinterStatus.expectRepeatedCallsWith().resolves({
      connected: true,
      // the below is copied from libs/printing to avoid importing a backend package
      config: {
        label: 'HP LaserJet Pro M404n',
        vendorId: 1008,
        productId: 49450,
        baseDeviceUri: 'usb://HP/LaserJet%20Pro%20M404-M405',
        ppd: 'generic-postscript-driver.ppd',
      },
      ...printerStatus,
    });
  }

  return {
    apiClient,

    assertComplete: apiClient.assertComplete,

    setAuthStatus(authStatus: DippedSmartCardAuth.AuthStatus) {
      apiClient.getAuthStatus.expectRepeatedCallsWith().resolves(authStatus);
    },

    setPrinterStatus,

    async authenticateAsSystemAdministrator() {
      // first verify that we're logged out
      await screen.findByText('VxAdmin is Locked');
      this.setAuthStatus({
        status: 'logged_in',
        user: fakeSystemAdministratorUser(),
        sessionExpiresAt: fakeSessionExpiresAt(),
        programmableCard: { status: 'no_card' },
      });
      await screen.findByText('Lock Machine');
    },

    async authenticateAsElectionManager(
      electionDefinition: ElectionDefinition
    ) {
      // first verify that we're logged out
      await screen.findByText('VxAdmin is Locked');

      this.setAuthStatus({
        status: 'logged_in',
        user: fakeElectionManagerUser({
          electionHash: electionDefinition.electionHash,
        }),
        sessionExpiresAt: fakeSessionExpiresAt(),
      });
      await screen.findByText('Lock Machine');
    },

    async logOut() {
      this.setAuthStatus({
        status: 'logged_out',
        reason: 'machine_locked',
      });
      await screen.findByText('VxAdmin is Locked');
    },

    expectCheckPin(pin: string) {
      apiClient.checkPin.expectCallWith({ pin }).resolves();
    },

    expectLogOut() {
      apiClient.logOut.expectCallWith().resolves();
    },

    expectProgramCard(
      userRole: 'system_administrator' | 'election_manager' | 'poll_worker',
      newPin?: string
    ) {
      apiClient.programCard
        .expectCallWith({ userRole })
        .resolves(ok({ pin: newPin }));
    },

    expectUnprogramCard() {
      apiClient.unprogramCard.expectCallWith().resolves(ok());
    },

    expectGetMachineConfig(
      machineConfig: MachineConfig = {
        machineId: '0000',
        codeVersion: 'dev',
      }
    ) {
      apiClient.getMachineConfig.expectCallWith().resolves(machineConfig);
    },

    expectGetUsbDriveStatus(status: UsbDriveStatus['status']): void {
      apiClient.getUsbDriveStatus
        .expectRepeatedCallsWith()
        .resolves(mockUsbDriveStatus(status));
    },

    expectEjectUsbDrive(): void {
      apiClient.ejectUsbDrive.expectCallWith().resolves();
    },

    expectFormatUsbDrive(): void {
      apiClient.formatUsbDrive.expectCallWith().resolves(ok());
    },

    expectGetCurrentElectionMetadata(
      metadata?: {
        electionDefinition: ElectionDefinition;
        isOfficialResults?: boolean;
        id?: string;
        createdAt?: string;
      } | null
    ) {
      apiClient.getCurrentElectionMetadata.expectCallWith().resolves(
        metadata
          ? {
              id: 'election-id',
              createdAt: new Date().toISOString(),
              isOfficialResults: false,
              ...metadata,
            }
          : null
      );
    },

    expectListPotentialElectionPackagesOnUsbDrive(
      electionPackages: Array<Partial<FileSystemEntry>> = []
    ) {
      apiClient.listPotentialElectionPackagesOnUsbDrive
        .expectCallWith()
        .resolves(
          ok(
            electionPackages.map((entry) => ({
              name: 'Test Election Package',
              path: 'package.zip',
              type: FileSystemEntryType.File,
              size: 1,
              mtime: new Date(),
              atime: new Date(),
              ctime: new Date(),
              ...entry,
            }))
          )
        );
    },

    expectConfigure(electionFilePath: string) {
      apiClient.configure
        .expectCallWith({ electionFilePath })
        .resolves(ok({ electionId: 'anything' }));
    },

    expectUnconfigure() {
      apiClient.unconfigure.expectCallWith().resolves();
    },

    expectGetSystemSettings(systemSettings?: SystemSettings) {
      apiClient.getSystemSettings
        .expectCallWith()
        .resolves(systemSettings ?? DEFAULT_SYSTEM_SETTINGS);
    },

    expectGetCastVoteRecordFileMode(fileMode: CvrFileMode) {
      apiClient.getCastVoteRecordFileMode.expectCallWith().resolves(fileMode);
    },

    expectGetCastVoteRecordFiles(fileRecords: CastVoteRecordFileRecord[]) {
      apiClient.getCastVoteRecordFiles.expectCallWith().resolves(fileRecords);
    },

    expectGetWriteInAdjudicationQueueMetadata(
      queueMetadata: WriteInAdjudicationQueueMetadata[],
      contestId?: ContestId
    ) {
      if (contestId) {
        apiClient.getWriteInAdjudicationQueueMetadata
          .expectCallWith({
            contestId,
          })
          .resolves(queueMetadata);
      } else {
        apiClient.getWriteInAdjudicationQueueMetadata
          .expectCallWith()
          .resolves(queueMetadata);
      }
    },

    expectGetWriteInAdjudicationQueue(writeInIds: Id[], contestId?: string) {
      if (contestId) {
        apiClient.getWriteInAdjudicationQueue
          .expectCallWith({ contestId })
          .resolves(writeInIds);
      } else {
        apiClient.getWriteInAdjudicationQueue
          .expectCallWith()
          .resolves(writeInIds);
      }
    },

    expectGetWriteInCandidates(
      writeInCandidates: WriteInCandidateRecord[],
      contestId?: string
    ) {
      if (contestId) {
        apiClient.getWriteInCandidates
          .expectCallWith({ contestId })
          .resolves(writeInCandidates);
      } else {
        apiClient.getWriteInCandidates
          .expectCallWith()
          .resolves(writeInCandidates);
      }
    },

    expectAddWriteInCandidate(
      input: { contestId: string; name: string },
      writeInCandidateRecord: WriteInCandidateRecord
    ) {
      apiClient.addWriteInCandidate
        .expectCallWith(input)
        .resolves(writeInCandidateRecord);
    },

    expectGetWriteInImageView(
      writeInId: string,
      imageView: Partial<WriteInImageView> = {}
    ) {
      apiClient.getWriteInImageView.expectCallWith({ writeInId }).resolves({
        writeInId,
        cvrId: 'id',
        imageUrl: 'WW91IGJlIGdvb2QsIEkgbG92ZSB5b3UuIFNlZSB5b3UgdG9tb3Jyb3cu',
        ballotCoordinates: mockRect,
        contestCoordinates: mockRect,
        writeInCoordinates: mockRect,
        ...imageView,
      });
    },

    expectGetWriteInAdjudicationContext(
      writeInId: string,
      adjudicationContext: Partial<WriteInAdjudicationContext> = {}
    ) {
      apiClient.getWriteInAdjudicationContext
        .expectCallWith({ writeInId })
        .resolves({
          writeIn: {
            id: writeInId,
            contestId: 'id',
            electionId: 'id',
            cvrId: 'id',
            optionId: 'id',
            status: 'pending',
          },
          relatedWriteIns: [],
          cvrId: 'id',
          cvrVotes: {},
          ...adjudicationContext,
        });
    },

    expectGetFirstPendingWriteInId(
      contestId: string,
      writeInId: string | null
    ) {
      apiClient.getFirstPendingWriteInId
        .expectCallWith({ contestId })
        .resolves(writeInId);
    },

    expectMarkResultsOfficial() {
      apiClient.markResultsOfficial.expectCallWith().resolves();
    },

    expectClearCastVoteRecordFiles() {
      apiClient.clearCastVoteRecordFiles.expectCallWith().resolves();
    },

    expectListCastVoteRecordFilesOnUsb(files: CastVoteRecordFileMetadata[]) {
      apiClient.listCastVoteRecordFilesOnUsb.expectCallWith().resolves(files);
    },

    expectDeleteAllManualResults() {
      apiClient.deleteAllManualResults.expectCallWith().resolves();
    },

    expectDeleteManualResults(input: ManualResultsIdentifier) {
      apiClient.deleteManualResults.expectCallWith(input).resolves();
    },

    expectSetManualResults(
      input: ManualResultsIdentifier & {
        manualResults: Tabulation.ManualElectionResults;
      }
    ) {
      apiClient.setManualResults.expectCallWith(input).resolves();
    },

    expectGetManualResults(
      input: ManualResultsIdentifier,
      results?: Tabulation.ManualElectionResults
    ) {
      apiClient.getManualResults.expectCallWith(input).resolves(
        results
          ? {
              ...input,
              manualResults: results,
              createdAt: new Date().toISOString(),
            }
          : null
      );
    },

    expectGetManualResultsMetadata(records: ManualResultsMetadataRecord[]) {
      apiClient.getManualResultsMetadata.expectCallWith().resolves(records);
    },

    expectSaveElectionPackageToUsb(
      result: Result<void, ExportDataError> = ok()
    ) {
      apiClient.saveElectionPackageToUsb.expectCallWith().resolves(result);
    },

    expectGetTotalBallotCount(count: number, deferResult = false) {
      const { promise, resolve } = deferred<number>();

      apiClient.getTotalBallotCount.expectCallWith().returns(promise);

      if (!deferResult) {
        resolve(count);
      }

      return {
        resolve: () => {
          resolve(count);
        },
      };
    },

    expectGetScannerBatches(result: ScannerBatch[]) {
      apiClient.getScannerBatches.expectCallWith().resolves(result);
    },

    expectGetResultsForTallyReports(
      input: {
        filter: Admin.FrontendReportingFilter;
        groupBy: Tabulation.GroupBy;
      },
      results: Tabulation.GroupList<Admin.TallyReportResults>,
      deferResult = false
    ) {
      const { promise, resolve } =
        deferred<Tabulation.GroupList<Admin.TallyReportResults>>();
      apiClient.getResultsForTallyReports
        .expectCallWith(input)
        .returns(promise);

      if (!deferResult) {
        resolve(results);
      }

      return {
        resolve: () => {
          resolve(results);
        },
      };
    },

    expectGetTallyReportPreview({
      reportSpec,
      warning,
      pdfContent,
    }: {
      reportSpec: TallyReportSpec;
      warning?: TallyReportWarning;
      pdfContent?: string;
    }) {
      apiClient.getTallyReportPreview.expectCallWith(reportSpec).resolves({
        pdf: Buffer.from(pdfContent ?? 'mock-pdf'),
        warning: warning ?? { type: 'none' },
      });
    },

    expectPrintTallyReport: createDeferredMock(apiClient.printTallyReport),
    expectExportTallyReportPdf: createDeferredMock(
      apiClient.exportTallyReportPdf
    ),
    expectExportTallyReportCsv: createDeferredMock(
      apiClient.exportTallyReportCsv
    ),
    expectExportCdfReport: createDeferredMock(
      apiClient.exportCdfElectionResultsReport
    ),

    expectGetBallotCountReportPreview({
      reportSpec,
      warning,
      pdfContent,
    }: {
      reportSpec: BallotCountReportSpec;
      warning?: BallotCountReportWarning;
      pdfContent?: string;
    }) {
      apiClient.getBallotCountReportPreview
        .expectCallWith(reportSpec)
        .resolves({
          pdf: Buffer.from(pdfContent ?? 'mock-pdf'),
          warning: warning ?? { type: 'none' },
        });
    },

    expectPrintBallotCountReport: createDeferredMock(
      apiClient.printBallotCountReport
    ),
    expectExportBallotCountReportPdf: createDeferredMock(
      apiClient.exportBallotCountReportPdf
    ),
    expectExportBallotCountReportCsv: createDeferredMock(
      apiClient.exportBallotCountReportCsv
    ),

    expectGetWriteInAdjudicationReportPreview(pdfContent: string) {
      apiClient.getWriteInAdjudicationReportPreview
        .expectCallWith()
        .resolves(Buffer.from(pdfContent));
    },

    expectPrintWriteInAdjudicationReport: createDeferredMock(
      apiClient.printWriteInAdjudicationReport
    ),
    expectExportWriteInAdjudicationReportPdf: createDeferredMock(
      apiClient.exportWriteInAdjudicationReportPdf
    ),
  };
}

export type ApiMock = ReturnType<typeof createApiMock>;
