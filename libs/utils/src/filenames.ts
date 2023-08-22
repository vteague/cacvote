import moment from 'moment';
import {
  Election,
  ElectionDefinition,
  MachineId,
  maybeParse,
  safeParseNumber,
} from '@votingworks/types';
import { assert, Optional, throwIllegalValue } from '@votingworks/basics';
import { basename } from 'path';

const SECTION_SEPARATOR = '__';
const SUBSECTION_SEPARATOR = '_';
const WORD_SEPARATOR = '-';
const TIME_FORMAT_STRING = `YYYY${WORD_SEPARATOR}MM${WORD_SEPARATOR}DD${SUBSECTION_SEPARATOR}HH${WORD_SEPARATOR}mm${WORD_SEPARATOR}ss`;

export const BALLOT_PACKAGE_FOLDER = 'ballot-packages';
export const SCANNER_RESULTS_FOLDER = 'cast-vote-records';
export const SCANNER_BACKUPS_FOLDER = 'scanner-backups';

export const CAST_VOTE_RECORD_REPORT_FILENAME = 'cast-vote-record-report.json';

export interface ElectionData {
  electionCounty: string;
  electionName: string;
  electionHash: string;
  timestamp: Date;
}

export interface CastVoteRecordReportListing {
  machineId: string;
  numberOfBallots: number;
  isTestModeResults: boolean;
  timestamp: Date;
}

function sanitizeString(
  input: string,
  { replaceInvalidCharsWith = '', defaultValue = 'placeholder' } = {}
): string {
  const sanitized = input
    .replace(/[^a-z0-9]+/gi, replaceInvalidCharsWith)
    .replace(/(^-|-$)+/g, '')
    .toLocaleLowerCase();
  return sanitized.trim().length === 0 ? defaultValue : sanitized;
}

/**
 * Convert an auto-generated name of the ballot configuration package zip archive
 * to the pieces of data contained in the name.
 */
export function parseBallotExportPackageInfoFromFilename(
  filename: string
): ElectionData | undefined {
  // There should be two underscores separating the timestamp from the election information
  const segments = filename.split(SECTION_SEPARATOR);
  if (segments.length !== 2) {
    return;
  }

  const [electionString, timeString] = segments;
  assert(typeof electionString !== 'undefined');

  let electionSegments = electionString.split(SUBSECTION_SEPARATOR);
  if (electionSegments.length !== 3) {
    return;
  }
  electionSegments = electionSegments.map((s) => s.replace(/-/g, ' '));
  const [electionCounty, electionName, electionHash] = electionSegments;
  assert(typeof electionCounty !== 'undefined');
  assert(typeof electionName !== 'undefined');
  assert(typeof electionHash !== 'undefined');

  const parsedTime = moment(timeString, TIME_FORMAT_STRING);
  return {
    electionCounty,
    electionName,
    electionHash,
    timestamp: parsedTime.toDate(),
  };
}

export function generateElectionBasedSubfolderName(
  election: Election,
  electionHash: string
): string {
  const electionCountyName = sanitizeString(election.county.name, {
    replaceInvalidCharsWith: WORD_SEPARATOR,
    defaultValue: 'county',
  });
  const electionTitle = sanitizeString(election.title, {
    replaceInvalidCharsWith: WORD_SEPARATOR,
    defaultValue: 'election',
  });
  return `${`${electionCountyName}${SUBSECTION_SEPARATOR}${electionTitle}`.toLocaleLowerCase()}${SUBSECTION_SEPARATOR}${electionHash.slice(
    0,
    10
  )}`;
}

/**
 * Generate the directory name for the cast vote record report.
 *
 * @deprecated
 */
export function generateCastVoteRecordReportDirectoryName(
  machineId: string,
  numBallotsScanned: number,
  isTestMode: boolean,
  time: Date = new Date()
): string {
  const machineString = `machine${SUBSECTION_SEPARATOR}${
    maybeParse(MachineId, machineId) ?? sanitizeString(machineId)
  }`;
  const ballotString = `${numBallotsScanned}${SUBSECTION_SEPARATOR}${
    numBallotsScanned === 1 ? 'ballot' : 'ballots'
  }`;
  const timeInformation = moment(time).format(TIME_FORMAT_STRING);
  const filename = `${machineString}${SECTION_SEPARATOR}${ballotString}${SECTION_SEPARATOR}${timeInformation}`;
  return isTestMode ? `TEST${SECTION_SEPARATOR}${filename}` : filename;
}

/**
 * Generates a name for a cast vote record export directory
 */
export function generateCastVoteRecordExportDirectoryName({
  inTestMode,
  machineId,
  time = new Date(),
}: {
  inTestMode: boolean;
  machineId: string;
  time?: Date;
}): string {
  const machineString = [
    'machine',
    maybeParse(MachineId, machineId) ?? sanitizeString(machineId),
  ].join(SUBSECTION_SEPARATOR);
  const timeString = moment(time).format(TIME_FORMAT_STRING);
  const directoryNameComponents = [machineString, timeString];
  if (inTestMode) {
    directoryNameComponents.unshift('TEST');
  }
  return directoryNameComponents.join(SECTION_SEPARATOR);
}

/**
 * Extract information about a CVR file from the filename. Expected filename
 * format with human-readable separators is:
 * [TEST__]machine_{machineId}__{numberOfBallots}_ballots__YYYY-MM-DD_HH-mm-ss.jsonl
 * This format is current as of 2023-02-22 and may be out of date if separator constants have changed
 *
 * If the the parsing is unsuccessful, returns `undefined`.
 */
export function parseCastVoteRecordReportDirectoryName(
  filename: string
): Optional<CastVoteRecordReportListing> {
  // TODO: no need to ignore extension once we don't accept .jsonl
  const fileBasename = basename(filename);
  const segments = fileBasename.split(SECTION_SEPARATOR);
  const isTestModeResults = segments.length === 4 && segments[0] === 'TEST';

  const postTestPrefixSegments = isTestModeResults
    ? segments.slice(1)
    : segments;
  if (postTestPrefixSegments.length !== 3) {
    return;
  }
  // extract machine id
  assert(typeof postTestPrefixSegments[0] !== 'undefined');
  const machineSegments = postTestPrefixSegments[0].split(SUBSECTION_SEPARATOR);
  if (machineSegments.length !== 2 || machineSegments[0] !== 'machine') {
    return;
  }
  const machineId = machineSegments[1];
  assert(typeof machineId !== 'undefined');

  // extract number of ballots
  assert(typeof postTestPrefixSegments[1] !== 'undefined');
  const ballotSegments = postTestPrefixSegments[1].split(SUBSECTION_SEPARATOR);
  if (
    ballotSegments.length !== 2 ||
    (ballotSegments[1] !== 'ballots' && ballotSegments[1] !== 'ballot')
  ) {
    return;
  }
  const numberOfBallotsParseResult = safeParseNumber(ballotSegments[0]);
  if (numberOfBallotsParseResult.isErr()) return;

  // extract timestamp
  const timestampMoment = moment(postTestPrefixSegments[2], TIME_FORMAT_STRING);
  if (!timestampMoment.isValid()) return;

  return {
    machineId,
    numberOfBallots: numberOfBallotsParseResult.ok(),
    isTestModeResults,
    timestamp: timestampMoment.toDate(),
  };
}

/* Get the name of an election to use in a filename from the Election object */
function generateElectionName(election: Election): string {
  const electionCountyName = sanitizeString(election.county.name, {
    replaceInvalidCharsWith: WORD_SEPARATOR,
    defaultValue: 'county',
  });
  const electionTitle = sanitizeString(election.title, {
    replaceInvalidCharsWith: WORD_SEPARATOR,
    defaultValue: 'election',
  });
  return `${electionCountyName}${SUBSECTION_SEPARATOR}${electionTitle}`;
}

export function getElectionDataFromElectionDefinition(
  electionDefinition: ElectionDefinition,
  timestamp: Date
): ElectionData {
  return {
    electionCounty: electionDefinition.election.county.name,
    electionHash: electionDefinition.electionHash,
    electionName: electionDefinition.election.title,
    timestamp,
  };
}

export function generateFilenameForBallotExportPackageFromElectionData({
  electionName,
  electionCounty,
  electionHash,
  timestamp,
}: ElectionData): string {
  const electionCountyName = sanitizeString(electionCounty, {
    replaceInvalidCharsWith: WORD_SEPARATOR,
    defaultValue: 'county',
  });
  const electionTitle = sanitizeString(electionName, {
    replaceInvalidCharsWith: WORD_SEPARATOR,
    defaultValue: 'election',
  });
  const electionInformation = `${electionCountyName}${SUBSECTION_SEPARATOR}${electionTitle}${SUBSECTION_SEPARATOR}${electionHash.slice(
    0,
    10
  )}`;
  const timeInformation = moment(timestamp).format(TIME_FORMAT_STRING);
  return `${electionInformation}${SECTION_SEPARATOR}${timeInformation}.zip`;
}

/* Generate the name for a ballot export package */
export function generateFilenameForBallotExportPackage(
  electionDefinition: ElectionDefinition,
  time: Date = new Date()
): string {
  return generateFilenameForBallotExportPackageFromElectionData(
    getElectionDataFromElectionDefinition(electionDefinition, time)
  );
}

/* Generate the filename for final results export from election manager */
export function generateFinalExportDefaultFilename(
  isTestModeResults: boolean,
  election: Election,
  time: Date = new Date()
): string {
  const filemode = isTestModeResults ? 'test' : 'live';
  const timeInformation = moment(time).format(TIME_FORMAT_STRING);
  const electionName = generateElectionName(election);
  return `votingworks${WORD_SEPARATOR}${filemode}${WORD_SEPARATOR}results${SUBSECTION_SEPARATOR}${electionName}${SUBSECTION_SEPARATOR}${timeInformation}.csv`;
}

/* Generate the filename for final sems results export from election manager */
export function generateSemsFinalExportDefaultFilename(
  isTestModeResults: boolean,
  election: Election,
  time: Date = new Date()
): string {
  const filemode = isTestModeResults ? 'test' : 'live';
  const timeInformation = moment(time).format(TIME_FORMAT_STRING);
  const electionName = generateElectionName(election);
  return `votingworks${WORD_SEPARATOR}sems${WORD_SEPARATOR}${filemode}${WORD_SEPARATOR}results${SUBSECTION_SEPARATOR}${electionName}${SUBSECTION_SEPARATOR}${timeInformation}.txt`;
}

/**
 * Generates a filename for the tally results CSV broken down by batch.
 * @param isTestModeResults Boolean representing if the results are testmode or livemode
 * @param election Election object we are generating the filename for
 * @param time Optional for the time we are generating the filename, defaults to the current time.
 * @returns string filename i.e. "votingworks-live-batch-results_election-name_timestamp.csv"
 */
export function generateBatchResultsDefaultFilename(
  isTestModeResults: boolean,
  election: Election,
  time: Date = new Date()
): string {
  const filemode = isTestModeResults ? 'test' : 'live';
  const timeInformation = moment(time).format(TIME_FORMAT_STRING);
  const electionName = generateElectionName(election);
  return `votingworks${WORD_SEPARATOR}${filemode}${WORD_SEPARATOR}batch-results${SUBSECTION_SEPARATOR}${electionName}${SUBSECTION_SEPARATOR}${timeInformation}.csv`;
}

/* Describes different formats of the log file. */
export enum LogFileType {
  Raw = 'raw',
  Cdf = 'cdf',
}

/**
 * Generates a filename for the logs file.
 * @param logFileName Name of the log file being exported
 * @param time Optional for the time we are generating the filename, defaults to the current time.
 * @returns string filename i.e. "vx-logs_timestamp.log"
 */
export function generateLogFilename(
  logFileName: string,
  fileType: LogFileType,
  time: Date = new Date()
): string {
  const timeInformation = moment(time).format(TIME_FORMAT_STRING);
  switch (fileType) {
    case LogFileType.Raw:
      return `${logFileName}${SUBSECTION_SEPARATOR}${timeInformation}.log`;
    case LogFileType.Cdf:
      return `${logFileName}${WORD_SEPARATOR}cdf${SUBSECTION_SEPARATOR}${timeInformation}.json`;
    /* c8 ignore next 2 */
    default:
      throwIllegalValue(fileType);
  }
}
