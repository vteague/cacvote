/* istanbul ignore file */
import fs from 'fs';
import path from 'path';
import {
  computeCastVoteRecordRootHashFromScratch,
  SIGNATURE_FILE_EXTENSION,
} from '@votingworks/auth';
import { assert, assertDefined } from '@votingworks/basics';
import {
  CastVoteRecordExportFileName,
  CastVoteRecordReportWithoutMetadataSchema,
  CVR,
  safeParseJson,
} from '@votingworks/types';
import { UsbDrive } from '@votingworks/usb-drive';
import {
  BALLOT_PACKAGE_FOLDER,
  getExportedCastVoteRecordIds,
  SCANNER_RESULTS_FOLDER,
} from '@votingworks/utils';

import { readCastVoteRecordExportMetadata } from './import';

function identifyFunction<T>(input: T): T {
  return input;
}

/**
 * Reads and parses a cast vote record given the path to an individual cast vote record directory.
 * Also returns the raw contents of the cast vote record report.
 */
export function readCastVoteRecord(castVoteRecordDirectoryPath: string): {
  castVoteRecord: CVR.CVR;
  castVoteRecordReportContents: string;
} {
  const castVoteRecordReportContents = fs.readFileSync(
    path.join(
      castVoteRecordDirectoryPath,
      CastVoteRecordExportFileName.CAST_VOTE_RECORD_REPORT
    ),
    'utf-8'
  );
  const castVoteRecordReportWithoutMetadata = safeParseJson(
    castVoteRecordReportContents,
    CastVoteRecordReportWithoutMetadataSchema
  ).unsafeUnwrap();
  const castVoteRecord = assertDefined(
    castVoteRecordReportWithoutMetadata.CVR?.[0]
  );
  return { castVoteRecord, castVoteRecordReportContents };
}

/**
 * The second input to {@link modifyCastVoteRecordExport}
 */
export interface CastVoteRecordExportModifications {
  castVoteRecordModifier?: (castVoteRecord: CVR.CVR) => CVR.CVR;
  castVoteRecordReportMetadataModifier?: (
    castVoteRecordReportMetadata: CVR.CastVoteRecordReport
  ) => CVR.CastVoteRecordReport;
  numCastVoteRecordsToKeep?: number;
}

/**
 * Modifies a cast vote record export. Specifically meant for modifying fixtures for tests.
 */
export async function modifyCastVoteRecordExport(
  exportDirectoryPath: string,
  modifications: CastVoteRecordExportModifications
): Promise<string> {
  const {
    castVoteRecordModifier = identifyFunction,
    castVoteRecordReportMetadataModifier = identifyFunction,
    numCastVoteRecordsToKeep,
  } = modifications;

  const modifiedExportDirectoryPath = `${exportDirectoryPath}-modified`;
  fs.cpSync(exportDirectoryPath, modifiedExportDirectoryPath, {
    recursive: true,
  });

  const castVoteRecordIds = await getExportedCastVoteRecordIds(
    modifiedExportDirectoryPath
  );
  for (const [i, castVoteRecordId] of [...castVoteRecordIds].sort().entries()) {
    const castVoteRecordDirectoryPath = path.join(
      modifiedExportDirectoryPath,
      castVoteRecordId
    );
    if (
      numCastVoteRecordsToKeep !== undefined &&
      i >= numCastVoteRecordsToKeep
    ) {
      fs.rmSync(castVoteRecordDirectoryPath, { recursive: true });
      continue;
    }

    const { castVoteRecord, castVoteRecordReportContents } = readCastVoteRecord(
      castVoteRecordDirectoryPath
    );
    fs.writeFileSync(
      path.join(
        castVoteRecordDirectoryPath,
        CastVoteRecordExportFileName.CAST_VOTE_RECORD_REPORT
      ),
      JSON.stringify({
        ...JSON.parse(castVoteRecordReportContents),
        CVR: [castVoteRecordModifier(castVoteRecord)],
      })
    );
  }

  const metadata = (
    await readCastVoteRecordExportMetadata(modifiedExportDirectoryPath)
  ).unsafeUnwrap();
  fs.writeFileSync(
    path.join(
      modifiedExportDirectoryPath,
      CastVoteRecordExportFileName.METADATA
    ),
    JSON.stringify({
      ...metadata,
      castVoteRecordReportMetadata: castVoteRecordReportMetadataModifier(
        metadata.castVoteRecordReportMetadata
      ),
      castVoteRecordRootHash: await computeCastVoteRecordRootHashFromScratch(
        modifiedExportDirectoryPath
      ),
    })
  );

  return modifiedExportDirectoryPath;
}

/**
 * Gets the paths of the cast vote record export directories on the inserted USB drive, in
 * alphabetical order. Assumes that there's only one election directory.
 */
export async function getCastVoteRecordExportDirectoryPaths(
  usbDrive: UsbDrive
): Promise<string[]> {
  const usbDriveStatus = await usbDrive.status();
  const usbMountPoint =
    usbDriveStatus.status === 'mounted' ? usbDriveStatus.mountPoint : undefined;
  assert(usbMountPoint !== undefined);

  const electionDirectoryNames = fs
    .readdirSync(usbMountPoint)
    .filter((name) => name !== BALLOT_PACKAGE_FOLDER);
  assert(electionDirectoryNames.length === 1);

  const electionResultsDirectoryPath = path.join(
    usbMountPoint,
    assertDefined(electionDirectoryNames[0]),
    SCANNER_RESULTS_FOLDER
  );
  const castVoteRecordExportDirectoryPaths = fs
    .readdirSync(electionResultsDirectoryPath)
    // Filter out signature files
    .filter((entryName) => !entryName.endsWith(SIGNATURE_FILE_EXTENSION))
    .map((entryName) => path.join(electionResultsDirectoryPath, entryName));
  return [...castVoteRecordExportDirectoryPaths].sort();
}
