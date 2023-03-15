import { Admin } from '@votingworks/api';
import { Result } from '@votingworks/basics';
import { Id } from '@votingworks/types';
import { AddCastVoteRecordError } from './store';

/**
 * Result of attempt to configure the app with a new election definition
 */
export type ConfigureResult = Result<
  { electionId: Id },
  { type: 'parsing'; message: string }
>;

/**
 * Errors that may occur when loading a cast vote record file from a path
 */
export type AddCastVoteRecordFileError =
  | { type: 'invalid-file'; userFriendlyMessage: string }
  | ({ type: 'invalid-record' } & AddCastVoteRecordError);

/**
 * Result of attempt to load a cast vote record file from a path
 */
export type AddCastVoteRecordFileResult = Result<
  Admin.CvrFileImportInfo,
  AddCastVoteRecordFileError
>;

/**
 * Metadata about a cast vote record file found on a USB drive.
 */
export interface CastVoteRecordFileMetadata {
  readonly name: string;
  readonly path: string;
  readonly cvrCount: number;
  readonly scannerIds: readonly string[];
  readonly exportTimestamp: Date;
  readonly isTestModeResults: boolean;
}
