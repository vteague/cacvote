//
// The durable datastore for election data, CVRs, and adjudication info.
//

import {
  Optional,
  Result,
  err,
  ok,
  typedAs,
  isResult,
  assertDefined,
  assert,
} from '@votingworks/basics';
import { Bindable, Client as DbClient } from '@votingworks/db';
import {
  AnyContest,
  BallotId,
  BallotPageLayout,
  BallotPageLayoutSchema,
  BallotStyle,
  BallotStyleId,
  ContestId,
  ContestOptionId,
  CVR,
  DistrictId,
  Election,
  Id,
  Iso8601Timestamp,
  Precinct,
  PrecinctId,
  safeParse,
  safeParseElectionDefinition,
  safeParseJson,
  Side,
  SystemSettings,
  safeParseSystemSettings,
  Tabulation,
} from '@votingworks/types';
import { join } from 'path';
import { Buffer } from 'buffer';
import { v4 as uuid } from 'uuid';
import {
  OfficialCandidateNameLookup,
  getOfficialCandidateNameLookup,
} from '@votingworks/utils';
import {
  CastVoteRecordFileRecord,
  CastVoteRecordFileRecordSchema,
  CvrFileMode,
  ElectionRecord,
  ManualResultsIdentifier,
  ManualResultsMetadataRecord,
  ManualResultsRecord,
  ScannerBatch,
  CastVoteRecordStoreFilter,
  WriteInAdjudicationAction,
  WriteInAdjudicationStatus,
  WriteInCandidateRecord,
  WriteInRecord,
  WriteInRecordAdjudicatedInvalid,
  WriteInRecordAdjudicatedOfficialCandidate,
  WriteInRecordAdjudicatedWriteInCandidate,
  WriteInRecordPending,
  WriteInTally,
  WriteInAdjudicatedInvalidTally,
  WriteInAdjudicatedOfficialCandidateTally,
  WriteInAdjudicatedWriteInCandidateTally,
  WriteInPendingTally,
  ManualResultsFilter,
  CardTally,
  WriteInAdjudicationQueueMetadata,
} from './types';
import { isBlankSheet } from './tabulation/utils';
import { rootDebug } from './util/debug';

const debug = rootDebug.extend('store');

type StoreCastVoteRecordAttributes = Omit<
  Tabulation.CastVoteRecordAttributes,
  'partyId'
> & {
  readonly partyId: string | null;
};

/**
 * Path to the store's schema file, i.e. the file that defines the database.
 */
const SchemaPath = join(__dirname, '../schema.sql');

function convertSqliteTimestampToIso8601(
  sqliteTimestamp: string
): Iso8601Timestamp {
  return new Date(sqliteTimestamp).toISOString();
}

function asQueryPlaceholders(list: unknown[]): string {
  const questionMarks = list.map(() => '?');
  return `(${questionMarks.join(', ')})`;
}

interface WriteInTallyRow {
  contestId: ContestId;
  isInvalid: boolean;
  officialCandidateId: string | null;
  writeInCandidateId: string | null;
  writeInCandidateName: string | null;
  tally: number;
}

/**
 * Manages a data store for imported election data, cast vote records, and
 * transcribed and adjudicated write-ins.
 */
export class Store {
  private constructor(private readonly client: DbClient) {}

  getDbPath(): string {
    return this.client.getDatabasePath();
  }

  /**
   * Builds and returns a new store whose data is kept in memory.
   */
  static memoryStore(): Store {
    return new Store(DbClient.memoryClient(SchemaPath));
  }

  /**
   * Builds and returns a new store at `dbPath`.
   */
  static fileStore(dbPath: string): Store {
    return new Store(DbClient.fileClient(dbPath, SchemaPath));
  }

  /**
   * Runs the given function in a transaction. If the function throws an error,
   * the transaction is rolled back. Otherwise, the transaction is committed.
   *
   * If the function returns a `Result` type, the transaction will only be be
   * rolled back if the returned `Result` is an error.
   *
   * Returns the result of the function.
   */
  withTransaction<T>(fn: () => T): T {
    return this.client.transaction(fn, (result: T) => {
      if (isResult(result)) {
        return result.isOk();
      }

      return true;
    });
  }

  /**
   * Creates an election record and returns its ID.
   */
  addElection(electionData: string): Id {
    const id = uuid();
    this.withTransaction(() => {
      this.client.run(
        'insert into elections (id, data) values (?, ?)',
        id,
        electionData
      );
      this.createElectionMetadataRecords(id);
    });

    return id;
  }

  /**
   * Gets all election records.
   */
  getElections(): ElectionRecord[] {
    return (
      this.client.all(`
      select
        id,
        data as electionData,
        datetime(created_at, 'localtime') as createdAt,
        is_official_results as isOfficialResults
      from elections
      where deleted_at is null
    `) as Array<{
        id: Id;
        electionData: string;
        createdAt: string;
        isOfficialResults: 0 | 1;
      }>
    ).map((r) => ({
      id: r.id,
      electionDefinition: safeParseElectionDefinition(
        r.electionData
      ).unsafeUnwrap(),
      createdAt: convertSqliteTimestampToIso8601(r.createdAt),
      isOfficialResults: r.isOfficialResults === 1,
    }));
  }

  /**
   * Gets a specific election record.
   */
  getElection(electionId: string): ElectionRecord | undefined {
    const result = this.client.one(
      `
      select
        id,
        data as electionData,
        datetime(created_at, 'localtime') as createdAt,
        is_official_results as isOfficialResults
      from elections
      where deleted_at is null AND id = ?
    `,
      electionId
    ) as
      | {
          id: Id;
          electionData: string;
          createdAt: string;
          isOfficialResults: 0 | 1;
        }
      | undefined;
    if (!result) {
      return undefined;
    }
    return {
      id: result.id,
      electionDefinition: safeParseElectionDefinition(
        result.electionData
      ).unsafeUnwrap(),
      createdAt: convertSqliteTimestampToIso8601(result.createdAt),
      isOfficialResults: result.isOfficialResults === 1,
    };
  }

  /**
   * Deletes an election record.
   */
  deleteElection(id: Id): void {
    this.client.run(
      'update elections set deleted_at = current_timestamp where id = ?',
      id
    );
  }

  /**
   * Asserts that an election with the given ID exists and is not deleted.
   */
  assertElectionExists(electionId: Id): void {
    const election = this.client.one(
      `
        select id from elections
        where id = ? and deleted_at is null
      `,
      electionId
    ) as { id: Id } | undefined;

    if (!election) {
      throw new Error(`Election not found: ${electionId}`);
    }
  }

  /**
   * Sets the id for the current election
   */
  setCurrentElectionId(currentElectionId?: Id): void {
    if (currentElectionId) {
      this.client.run(
        'update settings set current_election_id = ?',
        currentElectionId
      );
    } else {
      this.client.run('update settings set current_election_id = NULL');
    }
  }

  /**
   * Gets the id for the current election
   */
  getCurrentElectionId(): Optional<Id> {
    const settings = this.client.one(
      `
      select current_election_id as currentElectionId from settings
    `
    ) as { currentElectionId: Id } | null;

    return settings?.currentElectionId ?? undefined;
  }

  /**
   * Adds a subset of the election definition, normalized, to the database. While
   * the data is already in the election data blob, we want to be able to join on
   * and query the data.
   */
  private createElectionMetadataRecords(electionId: Id): void {
    const electionRecord = this.getElection(electionId);
    assert(electionRecord);
    const {
      electionDefinition: { election },
    } = electionRecord;

    this.addVotingMethodRecords({ electionId });

    for (const precinct of election.precincts) {
      this.createPrecinctRecord({ electionId, precinct });
    }

    for (const contest of election.contests) {
      this.createContestRecord({ electionId, contest });
    }

    for (const ballotStyle of election.ballotStyles) {
      this.createBallotStyleRecord({ electionId, ballotStyle });
      for (const precinctId of ballotStyle.precincts) {
        this.createBallotStylePrecinctLinkRecord({
          electionId,
          ballotStyleId: ballotStyle.id,
          precinctId,
        });
      }
      for (const districtId of ballotStyle.districts) {
        this.createBallotStyleDistrictLinkRecord({
          electionId,
          ballotStyleId: ballotStyle.id,
          districtId,
        });
      }
    }
  }

  /**
   * Adds a row to the `precincts` table for the given ballot style.
   */
  private createPrecinctRecord({
    electionId,
    precinct,
  }: {
    electionId: Id;
    precinct: Precinct;
  }): void {
    this.client.run(
      `
        insert into precincts (
          election_id,
          id,
          name
        ) values (
          ?, ?, ?
        )
      `,
      electionId,
      precinct.id,
      precinct.name
    );
  }

  /**
   * Adds a row to the `ballot_styles` table for the given ballot style.
   */
  private createBallotStyleRecord({
    electionId,
    ballotStyle,
  }: {
    electionId: Id;
    ballotStyle: BallotStyle;
  }): void {
    const params = [electionId, ballotStyle.id];
    if (ballotStyle.partyId) {
      params.push(ballotStyle.partyId);
    }

    this.client.run(
      `
        insert into ballot_styles (
          election_id,
          id,
          party_id
        ) values (
          ?, ?, ${ballotStyle.partyId ? '?' : 'null'}
        )
      `,
      ...params
    );
  }

  /**
   * Adds link record representing the association between a ballot style and a precinct.
   */
  private createBallotStylePrecinctLinkRecord({
    electionId,
    ballotStyleId,
    precinctId,
  }: {
    electionId: Id;
    ballotStyleId: BallotStyleId;
    precinctId: PrecinctId;
  }): void {
    this.client.run(
      `
        insert into ballot_styles_to_precincts (
          election_id,
          ballot_style_id,
          precinct_id
        ) values (
          ?, ?, ?
        )
      `,
      electionId,
      ballotStyleId,
      precinctId
    );
  }

  /**
   * Adds link record representing the association between a ballot style and a district.
   */
  private createBallotStyleDistrictLinkRecord({
    electionId,
    ballotStyleId,
    districtId,
  }: {
    electionId: Id;
    ballotStyleId: BallotStyleId;
    districtId: DistrictId;
  }): void {
    this.client.run(
      `
          insert into ballot_styles_to_districts (
            election_id,
            ballot_style_id,
            district_id
          ) values (
            ?, ?, ?
          )
        `,
      electionId,
      ballotStyleId,
      districtId
    );
  }

  /**
   * Adds record for an election contest.
   */
  private createContestRecord({
    electionId,
    contest,
  }: {
    electionId: Id;
    contest: AnyContest;
  }): void {
    this.client.run(
      `
            insert into contests (
              election_id,
              id,
              district_id,
              party_id
            ) values (
              ?, ?, ?, ?
            )
          `,
      electionId,
      contest.id,
      contest.districtId,
      contest.type === 'candidate' ? contest.partyId ?? null : null
    );
  }

  /**
   * Adds link record representing the association between a ballot style and a precinct.
   */
  private addVotingMethodRecords({ electionId }: { electionId: Id }): void {
    const params: Bindable[] = [];
    for (const votingMethod of Tabulation.SUPPORTED_VOTING_METHODS) {
      params.push(electionId, votingMethod);
    }

    this.client.run(
      `
          insert into voting_methods (
            election_id,
            voting_method
          ) 
          values 
            ${Tabulation.SUPPORTED_VOTING_METHODS.map(() => '(?, ?)').join(
              ',\n'
            )}
        `,
      ...params
    );
  }

  /**
   * Given the group by and filter of a tabulation operation, this method returns
   * what the expected groups would be. Ignores batch and scanner components which
   * are not currently supported.
   */
  getTabulationGroups({
    electionId,
    groupBy = {},
    filter = {},
  }: {
    electionId: Id;
    groupBy?: Tabulation.GroupBy;
    filter?: Tabulation.Filter;
  }): Tabulation.GroupSpecifier[] {
    const whereParts = ['ballot_styles.election_id = ?'];
    const params: Bindable[] = [electionId];
    if (filter.ballotStyleIds) {
      whereParts.push(
        `ballot_styles.id in ${asQueryPlaceholders(filter.ballotStyleIds)}`
      );
      params.push(...filter.ballotStyleIds);
    }
    if (filter.partyIds) {
      whereParts.push(
        `ballot_styles.party_id in ${asQueryPlaceholders(filter.partyIds)}`
      );
      params.push(...filter.partyIds);
    }
    if (filter.precinctIds) {
      whereParts.push(
        `ballot_styles_to_precincts.precinct_id in ${asQueryPlaceholders(
          filter.precinctIds
        )}`
      );
      params.push(...filter.precinctIds);
    }
    if (filter.votingMethods) {
      whereParts.push(
        `voting_methods.voting_method in ${asQueryPlaceholders(
          filter.votingMethods
        )}`
      );
      params.push(...filter.votingMethods);
    }

    const selectParts: string[] = [];
    const groupByParts: string[] = [];
    const sortByParts: string[] = [];
    if (groupBy.groupByPrecinct) {
      selectParts.push('precincts.id as precinctId');
      groupByParts.push('precinctId');
      sortByParts.push('precinctId');
    }
    if (groupBy.groupByParty) {
      selectParts.push('ballot_styles.party_id as partyId');
      groupByParts.push('partyId');
    }
    if (groupBy.groupByBallotStyle) {
      selectParts.push('ballot_styles.id as ballotStyleId');
      groupByParts.push('ballotStyleId');
    }
    if (groupBy.groupByVotingMethod) {
      selectParts.push('voting_methods.voting_method as votingMethod');
      groupByParts.push('votingMethod');
      sortByParts.push('votingMethod DESC'); // absentee last
    }

    const query = `
      select
          ${['1 as universalGroup', ...selectParts].join(',\n')}
        from ballot_styles
        inner join ballot_styles_to_precincts on
          ballot_styles_to_precincts.election_id = ballot_styles.election_id and 
          ballot_styles_to_precincts.ballot_style_id = ballot_styles.id
        inner join precincts on
          ballot_styles_to_precincts.election_id = precincts.election_id and 
          ballot_styles_to_precincts.precinct_id = precincts.id
        inner join voting_methods on
          voting_methods.election_id = ballot_styles.election_id
        where ${whereParts.join(' and ')}
        group by
          ${['universalGroup', ...groupByParts].join(',\n')}
        order by
          ${['universalGroup', ...sortByParts].join(',\n')}
    `;

    return (
      this.client.all(query, ...params) as Array<
        Partial<Tabulation.GroupSpecifier> & {
          universalGroup: number;
          precinctSortIndex?: number;
        }
      >
    ).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ universalGroup, precinctSortIndex, ...groupSpecifier }) =>
        groupSpecifier
    );
  }

  /**
   * Given a tabulation filter, returns the set of contests that would be
   * included on possible ballots.
   */
  getFilteredContests({
    electionId,
    filter = {},
  }: {
    electionId: Id;
    filter?: Tabulation.Filter;
  }): ContestId[] {
    const whereParts = ['contests.election_id = ?'];
    const ballotStyleParams: Bindable[] = [electionId];
    if (filter.ballotStyleIds) {
      whereParts.push(
        `ballot_styles.id in ${asQueryPlaceholders(filter.ballotStyleIds)}`
      );
      ballotStyleParams.push(...filter.ballotStyleIds);
    }
    if (filter.partyIds) {
      whereParts.push(
        `ballot_styles.party_id in ${asQueryPlaceholders(filter.partyIds)}`
      );
      ballotStyleParams.push(...filter.partyIds);
    }
    if (filter.precinctIds) {
      whereParts.push(
        `ballot_styles_to_precincts.precinct_id in ${asQueryPlaceholders(
          filter.precinctIds
        )}`
      );
      ballotStyleParams.push(...filter.precinctIds);
    }

    whereParts.push(
      `(contests.party_id is null or ballot_styles.party_id = contests.party_id)`
    );

    const query = `
      select contests.id as contestId
      from contests
      inner join ballot_styles_to_districts on
        ballot_styles_to_districts.election_id = ? and 
        ballot_styles_to_districts.district_id = contests.district_id
      inner join ballot_styles on
        ballot_styles.election_id = ? and
        ballot_styles.id = ballot_styles_to_districts.ballot_style_id
      inner join ballot_styles_to_precincts on
        ballot_styles_to_precincts.election_id = ? and 
        ballot_styles_to_precincts.ballot_style_id = ballot_styles.id
      where
        ${whereParts.join(' and\n')}
      group by contestId
    `;

    return (
      this.client.all(
        query,
        electionId,
        electionId,
        electionId,
        ...ballotStyleParams
      ) as Array<{
        contestId: ContestId;
      }>
    ).map(({ contestId }) => contestId);
  }

  /**
   * Stores the system settings.
   * Note `SystemSettings` are logical settings that span other machines eg. VxScan.
   * `Settings` are local to VxAdmin
   */
  saveSystemSettings(systemSettings: SystemSettings): void {
    this.client.run('delete from system_settings');
    this.client.run(
      `
      insert into system_settings (data) values (?)
      `,
      JSON.stringify(systemSettings)
    );
  }

  /**
   * Retrieves the system settings.
   */
  getSystemSettings(): SystemSettings | undefined {
    const result = this.client.one(`select data from system_settings`) as
      | { data: string }
      | undefined;

    if (!result) return undefined;
    return safeParseSystemSettings(result.data).unsafeUnwrap();
  }

  getCastVoteRecordFileByHash(
    electionId: Id,
    sha256Hash: string
  ): Optional<Id> {
    return (
      this.client.one(
        `
        select id
        from cvr_files
        where election_id = ?
          and sha256_hash = ?
      `,
        electionId,
        sha256Hash
      ) as { id: Id } | undefined
    )?.id;
  }

  getCastVoteRecordCountByFileId(fileId: Id): number {
    return (
      this.client.one(
        `
          select count(cvr_id) as alreadyPresent
          from cvr_file_entries
          where cvr_file_id = ?
        `,
        fileId
      ) as { alreadyPresent: number }
    ).alreadyPresent;
  }

  addCastVoteRecordFileRecord({
    id,
    electionId,
    isTestMode,
    filename,
    exportedTimestamp,
    sha256Hash,
    scannerIds,
  }: {
    id: Id;
    electionId: Id;
    isTestMode: boolean;
    filename: string;
    exportedTimestamp: Iso8601Timestamp;
    sha256Hash: string;
    scannerIds: Set<string>;
  }): void {
    this.client.run(
      `
        insert into cvr_files (
          id,
          election_id,
          is_test_mode,
          filename,
          export_timestamp,
          precinct_ids,
          scanner_ids,
          sha256_hash
        ) values (
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      id,
      electionId,
      isTestMode ? 1 : 0,
      filename,
      exportedTimestamp,
      JSON.stringify([]),
      JSON.stringify([...scannerIds]),
      sha256Hash
    );
  }

  updateCastVoteRecordFileRecord({
    id,
    precinctIds,
  }: {
    id: Id;
    precinctIds: Set<string>;
  }): void {
    this.client.run(
      `
        update cvr_files
        set
          precinct_ids = ?
        where id = ?
      `,
      JSON.stringify([...precinctIds]),
      id
    );
  }

  /**
   * Adds a CVR file entry record and returns its ID. If a CVR file entry with
   * the same contents has already been added, returns the ID of that record and
   * merely associates `cvrFileId` with it.
   */
  addCastVoteRecordFileEntry({
    electionId,
    cvrFileId,
    ballotId,
    cvr,
  }: {
    electionId: Id;
    cvrFileId: Id;
    ballotId: BallotId;
    cvr: Omit<Tabulation.CastVoteRecord, 'scannerId'>;
  }): Result<
    { cvrId: Id; isNew: boolean },
    {
      type: 'ballot-id-already-exists-with-different-data';
    }
  > {
    const cvrSheetNumber =
      cvr.card.type === 'bmd' ? null : cvr.card.sheetNumber;
    const serializedVotes = JSON.stringify(cvr.votes);
    const existingCvr = this.client.one(
      `
        select
          id,
          ballot_style_id as ballotStyleId,
          ballot_type as ballotType,
          batch_id as batchId,
          precinct_id as precinctId,
          sheet_number as sheetNumber,
          votes as votes
        from cvrs
        where
          election_id = ? and
          ballot_id = ?
      `,
      electionId,
      ballotId
    ) as
      | {
          id: Id;
          ballotStyleId: string;
          ballotType: CVR.vxBallotType;
          batchId: string;
          precinctId: string;
          sheetNumber: number | null;
          votes: string;
        }
      | undefined;

    const cvrId = existingCvr?.id ?? uuid();
    if (existingCvr) {
      // Existing cast vote records are expected, but existing cast vote records
      // with new data indicate a bad or inappropriately manipulated file
      if (
        !(
          existingCvr.ballotStyleId === cvr.ballotStyleId &&
          existingCvr.ballotType === cvr.votingMethod &&
          existingCvr.batchId === cvr.batchId &&
          existingCvr.precinctId === cvr.precinctId &&
          existingCvr.sheetNumber === cvrSheetNumber &&
          existingCvr.votes === serializedVotes
        )
      ) {
        return err({
          type: 'ballot-id-already-exists-with-different-data',
        });
      }
    } else {
      // Insert new cast vote record metadata and votes
      this.client.run(
        `
        insert into cvrs (
          id,
          election_id,
          ballot_id,
          ballot_style_id,
          ballot_type,
          batch_id,
          precinct_id,
          sheet_number,
          votes,
          is_blank
        ) values (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
        cvrId,
        electionId,
        ballotId,
        cvr.ballotStyleId,
        cvr.votingMethod,
        cvr.batchId,
        cvr.precinctId,
        cvrSheetNumber,
        serializedVotes,
        isBlankSheet(cvr.votes) ? 1 : 0
      );
    }

    // Whether the cast vote record itself is new or not, associate it with the new file.
    this.client.run(
      `
        insert or ignore into cvr_file_entries (
          cvr_file_id,
          cvr_id
        ) values (
          ?, ?
        )
      `,
      cvrFileId,
      cvrId
    );

    return ok({ cvrId, isNew: !existingCvr });
  }

  addBallotImage({
    cvrId,
    imageData,
    pageLayout,
    side,
  }: {
    cvrId: Id;
    imageData: Buffer;
    pageLayout: BallotPageLayout;
    side: Side;
  }): void {
    this.client.run(
      `
      insert into ballot_images (
        cvr_id,
        side,
        image,
        layout
      ) values (
        ?, ?, ?, ?
      )
    `,
      cvrId,
      side,
      imageData,
      JSON.stringify(pageLayout)
    );
  }

  addScannerBatch(scannerBatch: ScannerBatch): void {
    this.client.run(
      `
      insert or ignore into scanner_batches (
        id,
        label,
        scanner_id,
        election_id
      ) values (
        ?, ?, ?, ?
      )
    `,
      scannerBatch.batchId,
      scannerBatch.label,
      scannerBatch.scannerId,
      scannerBatch.electionId
    );
  }

  getScannerBatches(electionId: string): ScannerBatch[] {
    return this.client.all(
      `
        select
          id as batchId,
          label as label,
          scanner_id as scannerId,
          election_id as electionId
        from scanner_batches
        where
          election_id = ?
      `,
      electionId
    ) as ScannerBatch[];
  }

  deleteEmptyScannerBatches(electionId: string): void {
    this.client.run(
      `
        delete from scanner_batches
        where election_id = ?
          and not exists (
          select 1 from cvrs where id = cvrs.batch_id
        )
      `,
      electionId
    );
  }

  /**
   * Returns the current CVR file mode for the current election.
   */
  getCurrentCvrFileModeForElection(electionId: Id): CvrFileMode {
    const sampleCastVoteRecordFile = this.client.one(
      `
        select
          is_test_mode as isTestMode
        from cvr_files
        where
          election_id = ?
      `,
      electionId
    ) as { isTestMode: number } | undefined;

    if (!sampleCastVoteRecordFile) {
      return 'unlocked';
    }

    return sampleCastVoteRecordFile.isTestMode ? 'test' : 'official';
  }

  /**
   * Adds a write-in and returns its ID. Used when loading cast vote records.
   */
  addWriteIn({
    electionId,
    castVoteRecordId,
    side,
    contestId,
    optionId,
  }: {
    electionId: Id;
    castVoteRecordId: Id;
    side: Side;
    contestId: Id;
    optionId: Id;
  }): Id {
    const id = uuid();

    this.client.run(
      `
        insert into write_ins (
          id,
          election_id,
          cvr_id,
          side,
          contest_id,
          option_id
        ) values (
          ?, ?, ?, ?, ?, ?
        )
      `,
      id,
      electionId,
      castVoteRecordId,
      side,
      contestId,
      optionId
    );

    return id;
  }

  /**
   * Returns the write-in image and layout.
   */
  getWriteInImageAndLayout(writeInId: Id): {
    writeInId: Id;
    contestId: ContestId;
    optionId: ContestOptionId;
    cvrId: Id;
    image: Buffer;
    layout: BallotPageLayout;
  } {
    const row = this.client.one(
      `
          select
            write_ins.id as writeInId,
            write_ins.contest_id as contestId,
            write_ins.option_id as optionId,
            write_ins.cvr_id as cvrId,
            ballot_images.image as image,
            ballot_images.layout as layout
          from write_ins
          inner join
            ballot_images on 
              write_ins.cvr_id = ballot_images.cvr_id and 
              write_ins.side = ballot_images.side
          where write_ins.id = ?
        `,
      writeInId
    ) as {
      writeInId: Id;
      contestId: ContestId;
      optionId: ContestOptionId;
      cvrId: string;
      image: Buffer;
      layout: string;
    };

    return {
      ...row,
      layout: safeParseJson(row.layout, BallotPageLayoutSchema).unsafeUnwrap(),
    };
  }

  /**
   * Returns the write-in ids with votes on the associated CVR.
   */
  getWriteInWithVotes(writeInId: Id): {
    writeInId: Id;
    contestId: ContestId;
    optionId: ContestOptionId;
    cvrId: Id;
    cvrVotes: Tabulation.Votes;
  } {
    const row = this.client.one(
      `
        select
          write_ins.id as writeInId,
          write_ins.contest_id as contestId,
          write_ins.option_id as optionId,
          cvrs.votes as cvrVotes,
          write_ins.cvr_id as cvrId
        from write_ins
        inner join
          cvrs on
            write_ins.cvr_id = cvrs.id
        where write_ins.id = ?
      `,
      writeInId
    ) as {
      writeInId: Id;
      contestId: ContestId;
      optionId: ContestOptionId;
      cvrVotes: string;
      cvrId: string;
    };

    return {
      ...row,
      cvrVotes: JSON.parse(row.cvrVotes),
    };
  }

  getCvrFiles(electionId: Id): CastVoteRecordFileRecord[] {
    debug('querying database for cvr file list');
    const results = this.client.all(
      `
      select
        cvr_files.id as id,
        filename,
        export_timestamp as exportTimestamp,
        count(cvr_id) as numCvrsImported,
        precinct_ids as precinctIds,
        scanner_ids as scannerIds,
        sha256_hash as sha256Hash,
        datetime(cvr_files.created_at, 'localtime') as createdAt
      from cvr_files
      join (
        select
          cvr_file_entries.cvr_id,
          min(cvr_files.created_at) as min_import_date,
          cvr_file_entries.cvr_file_id
        from cvr_file_entries, cvr_files
        group by cvr_file_entries.cvr_id
      ) cvrs_by_min_import_date on
        cvrs_by_min_import_date.cvr_file_id = cvr_files.id
      where cvr_files.election_id = ?
      group by cvr_files.id
      order by export_timestamp desc
    `,
      electionId
    ) as Array<{
      id: Id;
      filename: string;
      exportTimestamp: string;
      numCvrsImported: number;
      precinctIds: string;
      scannerIds: string;
      sha256Hash: string;
      createdAt: string;
    }>;
    debug('queried database for cvr file list');

    return results
      .map((result) =>
        safeParse(CastVoteRecordFileRecordSchema, {
          id: result.id,
          electionId,
          sha256Hash: result.sha256Hash,
          filename: result.filename,
          exportTimestamp: convertSqliteTimestampToIso8601(
            result.exportTimestamp
          ),
          numCvrsImported: result.numCvrsImported,
          precinctIds: safeParseJson(result.precinctIds).unsafeUnwrap(),
          scannerIds: safeParseJson(result.scannerIds).unsafeUnwrap(),
          createdAt: convertSqliteTimestampToIso8601(result.createdAt),
        }).unsafeUnwrap()
      )
      .map<CastVoteRecordFileRecord>((parsedResult) => ({
        ...parsedResult,
        precinctIds: [...parsedResult.precinctIds].sort(),
        scannerIds: [...parsedResult.scannerIds].sort(),
      }));
  }

  private getTabulationFilterAsSql(
    electionId: Id,
    filter: Tabulation.Filter
  ): [whereParts: string[], params: Bindable[]] {
    const whereParts = ['cvrs.election_id = ?'];
    const params: Bindable[] = [electionId];

    if (filter.ballotStyleIds) {
      whereParts.push(
        `cvrs.ballot_style_id in ${asQueryPlaceholders(filter.ballotStyleIds)}`
      );
      params.push(...filter.ballotStyleIds);
    }

    if (filter.partyIds) {
      whereParts.push(
        `ballot_styles.party_id in ${asQueryPlaceholders(filter.partyIds)}`
      );
      params.push(...filter.partyIds);
    }

    if (filter.precinctIds) {
      whereParts.push(
        `cvrs.precinct_id in ${asQueryPlaceholders(filter.precinctIds)}`
      );
      params.push(...filter.precinctIds);
    }

    if (filter.votingMethods) {
      whereParts.push(
        `cvrs.ballot_type in ${asQueryPlaceholders(filter.votingMethods)}`
      );
      params.push(...filter.votingMethods);
    }

    if (filter.batchIds) {
      whereParts.push(
        `cvrs.batch_id in ${asQueryPlaceholders(filter.batchIds)}`
      );
      params.push(...filter.batchIds);
    }

    if (filter.scannerIds) {
      whereParts.push(
        `scanner_batches.scanner_id in ${asQueryPlaceholders(
          filter.scannerIds
        )}`
      );
      params.push(...filter.scannerIds);
    }

    return [whereParts, params];
  }

  private convertSheetNumberToCard(
    sheetNumber: number | null
  ): Tabulation.Card {
    return sheetNumber ? { type: 'hmpb', sheetNumber } : { type: 'bmd' };
  }

  /**
   * Returns an iterator of cast vote records for tabulation purposes. Filters
   * the cast vote records by specified filters.
   */
  *getCastVoteRecords({
    electionId,
    filter,
  }: {
    electionId: Id;
    filter: Tabulation.Filter;
  }): Generator<Tabulation.CastVoteRecord> {
    const [whereParts, params] = this.getTabulationFilterAsSql(
      electionId,
      filter
    );

    for (const row of this.client.each(
      `
        select
          cvrs.ballot_style_id as ballotStyleId,
          ballot_styles.party_id as partyId,
          cvrs.precinct_id as precinctId,
          cvrs.ballot_type as votingMethod,
          cvrs.batch_id as batchId,
          scanner_batches.scanner_id as scannerId,
          cvrs.sheet_number as sheetNumber,
          cvrs.votes as votes
        from cvrs 
        inner join scanner_batches on cvrs.batch_id = scanner_batches.id
        inner join ballot_styles on
          cvrs.election_id = ballot_styles.election_id and 
          cvrs.ballot_style_id = ballot_styles.id
        where ${whereParts.join(' and ')}
      `,
      ...params
    ) as Iterable<
      StoreCastVoteRecordAttributes & {
        sheetNumber: number | null;
        votes: string;
      }
    >) {
      yield {
        ballotStyleId: row.ballotStyleId,
        partyId: row.partyId ?? undefined,
        votingMethod: row.votingMethod,
        batchId: row.batchId,
        scannerId: row.scannerId,
        precinctId: row.precinctId,
        card: this.convertSheetNumberToCard(row.sheetNumber),
        votes: JSON.parse(row.votes),
      };
    }
  }

  /**
   * Gets card tallies grouped by cast vote record attributes.
   */
  *getCardTallies({
    electionId,
    groupBy = {},
    blankBallotsOnly = false,
  }: {
    electionId: Id;
    groupBy?: Tabulation.GroupBy;
    blankBallotsOnly?: boolean;
  }): Generator<Tabulation.GroupOf<CardTally>> {
    const whereParts = ['cvrs.election_id = ?'];
    const params: Bindable[] = [electionId];

    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    if (groupBy.groupByBallotStyle) {
      selectParts.push('cvrs.ballot_style_id as ballotStyleId');
      groupByParts.push('cvrs.ballot_style_id');
    }

    if (groupBy.groupByParty) {
      selectParts.push('ballot_styles.party_id as partyId');
      groupByParts.push('ballot_styles.party_id');
    }

    if (groupBy.groupByBatch) {
      selectParts.push('cvrs.batch_id as batchId');
      groupByParts.push('cvrs.batch_id');
    }

    if (groupBy.groupByPrecinct) {
      selectParts.push('cvrs.precinct_id as precinctId');
      groupByParts.push('cvrs.precinct_id');
    }

    if (groupBy.groupByScanner) {
      selectParts.push('scanner_batches.scanner_id as scannerId');
      groupByParts.push('scanner_batches.scanner_id');
    }

    if (groupBy.groupByVotingMethod) {
      selectParts.push('cvrs.ballot_type as votingMethod');
      groupByParts.push('cvrs.ballot_type');
    }

    if (blankBallotsOnly) {
      whereParts.push('cvrs.is_blank = 1');
    }
    for (const row of this.client.each(
      `
          select
            ${selectParts.map((line) => `${line},`).join('\n')}
            cvrs.sheet_number as sheetNumber,
            count(cvrs.id) as tally
          from cvrs 
          inner join scanner_batches on cvrs.batch_id = scanner_batches.id
          inner join ballot_styles on
            cvrs.election_id = ballot_styles.election_id and 
            cvrs.ballot_style_id = ballot_styles.id
          where ${whereParts.join(' and ')}
          group by
            ${groupByParts.map((line) => `${line},`).join('\n')}
            sheetNumber
        `,
      ...params
    ) as Iterable<
      Partial<StoreCastVoteRecordAttributes> & {
        sheetNumber: number | null;
        tally: number;
      }
    >) {
      const groupSpecifier: Tabulation.GroupSpecifier = {
        ballotStyleId: groupBy.groupByBallotStyle
          ? row.ballotStyleId
          : undefined,
        partyId: groupBy.groupByParty ? row.partyId ?? undefined : undefined,
        batchId: groupBy.groupByBatch ? row.batchId : undefined,
        scannerId: groupBy.groupByScanner ? row.scannerId : undefined,
        precinctId: groupBy.groupByPrecinct ? row.precinctId : undefined,
        votingMethod: groupBy.groupByVotingMethod
          ? row.votingMethod
          : undefined,
      };

      yield {
        ...groupSpecifier,
        card: this.convertSheetNumberToCard(row.sheetNumber),
        tally: row.tally,
      };
    }
  }

  /**
   * Deletes all CVR files for an election.
   */
  deleteCastVoteRecordFiles(electionId: Id): void {
    this.client.transaction(() => {
      this.client.run(
        `
          delete from cvr_file_entries
          where cvr_file_id in (
            select id from cvr_files where election_id = ?
          )
        `,
        electionId
      );
      this.client.run(
        `
          delete from cvr_files
          where election_id = ?
        `,
        electionId
      );
      this.client.run(
        `
          delete from cvrs
          where not exists (
            select 1 from cvr_file_entries where cvr_id = cvrs.id
          )
        `
      );
      this.client.run(
        `
          delete from write_in_candidates
          where election_id = ?
        `,
        electionId
      );
      this.deleteEmptyScannerBatches(electionId);
    });
  }

  getWriteInCandidates({
    electionId,
    contestId,
  }: {
    electionId: Id;
    contestId?: ContestId;
  }): WriteInCandidateRecord[] {
    const whereParts: string[] = ['election_id = ?'];
    const params: Bindable[] = [electionId];

    if (contestId) {
      whereParts.push('contest_id = ?');
      params.push(contestId);
    }

    const rows = this.client.all(
      `
        select
          id,
          contest_id as contestId,
          name as name
        from write_in_candidates
        where ${whereParts.join(' and ')}
      `,
      ...params
    ) as Array<{
      id: Id;
      contestId: ContestId;
      name: string;
    }>;

    return rows.map((row) => ({
      electionId,
      ...row,
    }));
  }

  addWriteInCandidate({
    electionId,
    contestId,
    name,
  }: Omit<WriteInCandidateRecord, 'id'>): WriteInCandidateRecord {
    const id = uuid();

    this.client.run(
      `
        insert into write_in_candidates 
          (id, election_id, contest_id, name)
        values
          (?, ?, ?, ?)
      `,
      id,
      electionId,
      contestId,
      name
    );

    return {
      id,
      electionId,
      contestId,
      name,
    };
  }

  private deleteWriteInCandidateIfChildless(id: Id): void {
    const adjudicatedWriteIn = this.client.one(
      `
        select id from write_ins
        where write_in_candidate_id = ?
      `,
      id
    ) as { id: Id } | undefined;

    const manualResultId = this.client.one(
      `
        select manual_result_id from manual_result_write_in_candidate_references
        where write_in_candidate_id = ?
      `,
      id
    ) as { id: Id } | undefined;

    if (!adjudicatedWriteIn && !manualResultId) {
      this.client.run(
        `
          delete from write_in_candidates
          where id = ?
        `,
        id
      );
    }
  }

  private deleteAllChildlessWriteInCandidates(): void {
    this.client.run(
      `
      delete from write_in_candidates
      where 
        id not in (
          select distinct write_in_candidate_id
          from write_ins
          where write_in_candidate_id is not null
        ) and 
        id not in (
          select distinct write_in_candidate_id
          from manual_result_write_in_candidate_references
        )
      `
    );
  }

  formatWriteInTallyRow(
    row: WriteInTallyRow,
    officialCandidateNameLookup: OfficialCandidateNameLookup
  ): WriteInTally {
    if (row.officialCandidateId) {
      return typedAs<WriteInAdjudicatedOfficialCandidateTally>({
        status: 'adjudicated',
        adjudicationType: 'official-candidate',
        contestId: row.contestId,
        tally: row.tally,
        candidateId: row.officialCandidateId,
        candidateName: officialCandidateNameLookup.get(
          row.contestId,
          row.officialCandidateId
        ),
      });
    }

    if (row.writeInCandidateId) {
      assert(row.writeInCandidateName !== null);
      return typedAs<WriteInAdjudicatedWriteInCandidateTally>({
        status: 'adjudicated',
        adjudicationType: 'write-in-candidate',
        contestId: row.contestId,
        tally: row.tally,
        candidateId: row.writeInCandidateId,
        candidateName: row.writeInCandidateName,
      });
    }

    if (row.isInvalid) {
      return typedAs<WriteInAdjudicatedInvalidTally>({
        status: 'adjudicated',
        adjudicationType: 'invalid',
        contestId: row.contestId,
        tally: row.tally,
      });
    }

    return typedAs<WriteInPendingTally>({
      status: 'pending',
      contestId: row.contestId,
      tally: row.tally,
    });
  }

  /**
   * Gets write-in adjudication tallies.
   */
  getWriteInAdjudicationQueueMetadata({
    electionId,
    contestId,
  }: {
    electionId: Id;
    contestId?: ContestId;
  }): WriteInAdjudicationQueueMetadata[] {
    debug(
      'querying database for write-in adjudication queue metadata for contest %s',
      contestId
    );
    const whereParts: string[] = ['write_ins.election_id = ?'];
    const params: Bindable[] = [electionId];

    if (contestId) {
      whereParts.push('write_ins.contest_id = ?');
      params.push(contestId);
    }

    const rows = this.client.all(
      `
        select
          contest_id as contestId,
          count(id) as totalTally,
          sum(
            (
              (case when official_candidate_id is null then 0 else 1 end) +
              (case when write_in_candidate_id is null then 0 else 1 end) +
              is_invalid
            ) = 0
          ) as pendingTally
        from write_ins
        where ${whereParts.join(' and ')}
        group by contest_id
      `,
      ...params
    ) as Array<{
      contestId: ContestId;
      totalTally: number;
      pendingTally: number;
    }>;
    debug('queried database for write-in adjudication queue metadata');
    return rows;
  }

  /**
   * Gets write-in tallies specifically for tabulation, filtered and and
   * grouped by cast vote record attributes.
   */
  *getWriteInTalliesForTabulation({
    electionId,
    election,
    filter = {},
    groupBy = {},
  }: {
    electionId: Id;
    election: Election;
    filter?: CastVoteRecordStoreFilter;
    groupBy?: Tabulation.GroupBy;
  }): Generator<Tabulation.GroupOf<WriteInTally>> {
    const [whereParts, params] = this.getTabulationFilterAsSql(
      electionId,
      filter
    );

    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    if (groupBy.groupByBallotStyle) {
      selectParts.push('cvrs.ballot_style_id as ballotStyleId');
      groupByParts.push('cvrs.ballot_style_id');
    }

    if (groupBy.groupByParty) {
      selectParts.push('ballot_styles.party_id as partyId');
      groupByParts.push('ballot_styles.party_id');
    }

    if (groupBy.groupByBatch) {
      selectParts.push('cvrs.batch_id as batchId');
      groupByParts.push('cvrs.batch_id');
    }

    if (groupBy.groupByPrecinct) {
      selectParts.push('cvrs.precinct_id as precinctId');
      groupByParts.push('cvrs.precinct_id');
    }

    if (groupBy.groupByScanner) {
      selectParts.push('scanner_batches.scanner_id as scannerId');
      groupByParts.push('scanner_batches.scanner_id');
    }

    if (groupBy.groupByVotingMethod) {
      selectParts.push('cvrs.ballot_type as votingMethod');
      groupByParts.push('cvrs.ballot_type');
    }

    const officialCandidateNameLookup =
      getOfficialCandidateNameLookup(election);

    for (const row of this.client.each(
      `
          select
            ${selectParts.map((line) => `${line},`).join('\n')}
            write_ins.contest_id as contestId,
            write_ins.official_candidate_id as officialCandidateId,
            write_ins.write_in_candidate_id as writeInCandidateId,
            write_in_candidates.name as writeInCandidateName,
            write_ins.is_invalid as isInvalid,
            count(write_ins.id) as tally
          from write_ins
          inner join
            cvrs on write_ins.cvr_id = cvrs.id
          inner join scanner_batches on cvrs.batch_id = scanner_batches.id
          inner join ballot_styles on
              cvrs.election_id = ballot_styles.election_id and 
              cvrs.ballot_style_id = ballot_styles.id
          left join
            write_in_candidates on write_in_candidates.id = write_ins.write_in_candidate_id
          where ${whereParts.join(' and ')}
          group by 
            ${groupByParts.map((line) => `${line},`).join('\n')}
            write_ins.contest_id,
            write_ins.official_candidate_id,
            write_ins.write_in_candidate_id,
            write_ins.is_invalid
        `,
      ...params
    ) as Iterable<WriteInTallyRow & Partial<StoreCastVoteRecordAttributes>>) {
      const groupSpecifier: Tabulation.GroupSpecifier = {
        ballotStyleId: groupBy.groupByBallotStyle
          ? row.ballotStyleId
          : undefined,
        partyId: groupBy.groupByParty ? row.partyId ?? undefined : undefined,
        batchId: groupBy.groupByBatch ? row.batchId : undefined,
        scannerId: groupBy.groupByScanner ? row.scannerId : undefined,
        precinctId: groupBy.groupByPrecinct ? row.precinctId : undefined,
        votingMethod: groupBy.groupByVotingMethod
          ? row.votingMethod
          : undefined,
      };

      yield {
        ...groupSpecifier,
        ...this.formatWriteInTallyRow(row, officialCandidateNameLookup),
      };
    }
  }

  /**
   * Gets write-in records filtered by the given options.
   */
  getWriteInRecords({
    electionId,
    contestId,
    castVoteRecordId,
    writeInId,
    status,
    limit,
  }: {
    electionId: Id;
    contestId?: ContestId;
    castVoteRecordId?: Id;
    writeInId?: Id;
    status?: WriteInAdjudicationStatus;
    limit?: number;
  }): WriteInRecord[] {
    debug('querying database for write-in records');
    this.assertElectionExists(electionId);

    const whereParts: string[] = ['write_ins.election_id = ?'];
    const params: Bindable[] = [electionId];

    if (contestId) {
      whereParts.push('write_ins.contest_id = ?');
      params.push(contestId);
    }

    if (castVoteRecordId) {
      whereParts.push('write_ins.cvr_id = ?');
      params.push(castVoteRecordId);
    }

    if (writeInId) {
      whereParts.push('write_ins.id = ?');
      params.push(writeInId);
    }

    if (status === 'adjudicated') {
      whereParts.push(
        '(write_ins.official_candidate_id is not null or write_ins.write_in_candidate_id is not null or write_ins.is_invalid = 1)'
      );
    } else if (status === 'pending') {
      whereParts.push('write_ins.official_candidate_id is null');
      whereParts.push('write_ins.write_in_candidate_id is null');
      whereParts.push('write_ins.is_invalid = 0');
    }

    if (typeof limit === 'number') {
      params.push(limit);
    }

    const writeInRows = this.client.all(
      `
        select distinct
          write_ins.id as id,
          write_ins.cvr_id as castVoteRecordId,
          write_ins.contest_id as contestId,
          write_ins.option_id as optionId,
          write_ins.official_candidate_id as officialCandidateId,
          write_ins.write_in_candidate_id as writeInCandidateId,
          write_ins.is_invalid as isInvalid,
          datetime(write_ins.adjudicated_at, 'localtime') as adjudicatedAt
        from write_ins
        where
          ${whereParts.join(' and ')}
        order by
          write_ins.cvr_id,
          write_ins.option_id
        ${typeof limit === 'number' ? 'limit ?' : ''}
      `,
      ...params
    ) as Array<{
      id: Id;
      castVoteRecordId: Id;
      contestId: ContestId;
      optionId: ContestOptionId;
      isInvalid: boolean;
      officialCandidateId: string | null;
      writeInCandidateId: Id | null;
      adjudicatedAt: Iso8601Timestamp | null;
    }>;
    debug('queried database for write-in records');

    return writeInRows
      .map((row) => {
        if (row.officialCandidateId) {
          return typedAs<WriteInRecordAdjudicatedOfficialCandidate>({
            id: row.id,
            castVoteRecordId: row.castVoteRecordId,
            contestId: row.contestId,
            optionId: row.optionId,
            status: 'adjudicated',
            adjudicationType: 'official-candidate',
            candidateId: row.officialCandidateId,
          });
        }

        if (row.writeInCandidateId) {
          return typedAs<WriteInRecordAdjudicatedWriteInCandidate>({
            id: row.id,
            castVoteRecordId: row.castVoteRecordId,
            contestId: row.contestId,
            optionId: row.optionId,
            status: 'adjudicated',
            adjudicationType: 'write-in-candidate',
            candidateId: row.writeInCandidateId,
          });
        }

        if (row.isInvalid) {
          return typedAs<WriteInRecordAdjudicatedInvalid>({
            id: row.id,
            castVoteRecordId: row.castVoteRecordId,
            contestId: row.contestId,
            optionId: row.optionId,
            status: 'adjudicated',
            adjudicationType: 'invalid',
          });
        }

        return typedAs<WriteInRecordPending>({
          id: row.id,
          status: 'pending',
          castVoteRecordId: row.castVoteRecordId,
          contestId: row.contestId,
          optionId: row.optionId,
        });
      })
      .filter((writeInRecord) => writeInRecord.status === status || !status);
  }

  /**
   * Gets write-in record adjudication queue for a specific contest.
   */
  getWriteInAdjudicationQueue({
    electionId,
    contestId,
  }: {
    electionId: Id;
    contestId?: ContestId;
  }): Id[] {
    this.assertElectionExists(electionId);

    const whereParts: string[] = ['election_id = ?'];
    const params: Bindable[] = [electionId];

    if (contestId) {
      whereParts.push('contest_id = ?');
      params.push(contestId);
    }

    debug(
      'querying database for write-in adjudication queue for contest %s',
      contestId
    );
    const rows = this.client.all(
      `
        select
          id
        from write_ins
        where
          ${whereParts.join(' and ')}
        order by
          sequence_id
      `,
      ...params
    ) as Array<{ id: Id }>;
    debug('queried database for write-in adjudication queue');

    return rows.map((r) => r.id);
  }

  /**
   * Within a contest adjudication queue provided by `getWriteInAdjudicationQueue`,
   * gets the id of the first write-in that is pending adjudication.
   */
  getFirstPendingWriteInId({
    electionId,
    contestId,
  }: {
    electionId: Id;
    contestId: ContestId;
  }): Optional<Id> {
    this.assertElectionExists(electionId);

    debug(
      'querying database for first pending write-in for contest %s',
      contestId
    );
    const row = this.client.one(
      `
        select
          id
        from write_ins
        where
          election_id = ? and
          contest_id = ? and
          official_candidate_id is null and
          write_in_candidate_id is null and
          is_invalid = 0
        order by
          sequence_id
        limit 1
      `,
      electionId,
      contestId
    ) as { id: Id } | undefined;
    debug('queried database for first pending write-in');

    return row?.id;
  }

  /**
   * Adjudicates a write-in.
   */
  adjudicateWriteIn(adjudicationAction: WriteInAdjudicationAction): void {
    const [initialWriteInRecord] = this.getWriteInRecords({
      electionId: assertDefined(this.getCurrentElectionId()),
      writeInId: adjudicationAction.writeInId,
    });
    assert(initialWriteInRecord, 'write-in record does not exist');

    const params =
      adjudicationAction.type === 'invalid'
        ? [adjudicationAction.writeInId]
        : [adjudicationAction.candidateId, adjudicationAction.writeInId];

    this.client.run(
      `
        update write_ins
        set 
          is_invalid = ${adjudicationAction.type === 'invalid' ? 1 : 0}, 
          official_candidate_id = ${
            adjudicationAction.type === 'official-candidate' ? '?' : 'null'
          }, 
          write_in_candidate_id = ${
            adjudicationAction.type === 'write-in-candidate' ? '?' : 'null'
          }, 
          adjudicated_at = current_timestamp
        where id = ?
      `,
      ...params
    );

    // if we are switching away from a write-in candidate, we may have to clean
    // up the record if it has no references
    if (
      initialWriteInRecord.status === 'adjudicated' &&
      initialWriteInRecord.adjudicationType === 'write-in-candidate'
    ) {
      this.deleteWriteInCandidateIfChildless(initialWriteInRecord.candidateId);
    }
  }

  deleteAllManualResults({ electionId }: { electionId: Id }): void {
    this.client.run(
      `delete from manual_results where election_id = ?`,
      electionId
    );

    // removing manual results may have left unofficial write-in candidates
    // without any references, so we delete them
    this.deleteAllChildlessWriteInCandidates();
  }

  deleteManualResults({
    electionId,
    precinctId,
    ballotStyleId,
    votingMethod,
  }: { electionId: Id } & ManualResultsIdentifier): void {
    this.client.run(
      `
        delete from manual_results
        where 
          election_id = ? and
          precinct_id = ? and
          ballot_style_id = ? and
          voting_method = ?`,
      electionId,
      precinctId,
      ballotStyleId,
      votingMethod
    );

    // removing the manual result may have left unofficial write-in candidates
    // without any references, so we delete them
    this.deleteAllChildlessWriteInCandidates();
  }

  setManualResults({
    electionId,
    precinctId,
    ballotStyleId,
    votingMethod,
    manualResults,
  }: ManualResultsIdentifier & {
    electionId: Id;
    manualResults: Tabulation.ManualElectionResults;
  }): void {
    const { ballotCount } = manualResults;
    const serializedContestResults = JSON.stringify(
      manualResults.contestResults
    );

    const { id: manualResultsRecordId } = this.client.one(
      `
        insert into manual_results (
          election_id,
          precinct_id,
          ballot_style_id,
          voting_method,
          ballot_count,
          contest_results
        ) values 
          (?, ?, ?, ?, ?, ?)
        on conflict
          (election_id, precinct_id, ballot_style_id, voting_method)
        do update set
          ballot_count = excluded.ballot_count,
          contest_results = excluded.contest_results
        returning (id)
      `,
      electionId,
      precinctId,
      ballotStyleId,
      votingMethod,
      ballotCount,
      serializedContestResults
    ) as { id: Id };

    // delete any previous write-in candidate references
    this.client.run(
      `
        delete from manual_result_write_in_candidate_references
        where manual_result_id = ?
      `,
      manualResultsRecordId
    );

    // check for the current write-in candidate references
    const writeInCandidateIds: Id[] = [];
    for (const contesResults of Object.values(manualResults.contestResults)) {
      assert(contesResults);
      if (contesResults.contestType === 'candidate') {
        for (const candidateTally of Object.values(contesResults.tallies)) {
          if (candidateTally.isWriteIn) {
            writeInCandidateIds.push(candidateTally.id);
          }
        }
      }
    }

    if (writeInCandidateIds.length > 0) {
      const params: Bindable[] = [];
      const questionMarks: string[] = [];
      for (const writeInCandidateId of writeInCandidateIds) {
        params.push(manualResultsRecordId, writeInCandidateId);
        questionMarks.push('(?, ?)');
      }

      // insert new write-in candidate references
      this.client.run(
        `
          insert into manual_result_write_in_candidate_references (
            manual_result_id,
            write_in_candidate_id
          ) values ${questionMarks.join(', ')}
        `,
        ...params
      );
    }

    // delete write-in candidates that may have only been included on the
    // previously entered manual results and are now not referenced
    this.deleteAllChildlessWriteInCandidates();
  }

  getManualResults({
    electionId,
    filter = {},
  }: {
    electionId: Id;
    filter?: ManualResultsFilter;
  }): ManualResultsRecord[] {
    const whereParts = ['manual_results.election_id = ?'];
    const params: Bindable[] = [electionId];
    const { precinctIds, partyIds, ballotStyleIds, votingMethods } = filter;

    if (precinctIds) {
      whereParts.push(
        `manual_results.precinct_id in ${asQueryPlaceholders(precinctIds)}`
      );
      params.push(...precinctIds);
    }

    if (partyIds) {
      whereParts.push(
        `ballot_styles.party_id in ${asQueryPlaceholders(partyIds)}`
      );
      params.push(...partyIds);
    }

    if (ballotStyleIds) {
      whereParts.push(
        `manual_results.ballot_style_id in ${asQueryPlaceholders(
          ballotStyleIds
        )}`
      );
      params.push(...ballotStyleIds);
    }

    if (votingMethods) {
      whereParts.push(
        `manual_results.voting_method in ${asQueryPlaceholders(votingMethods)}`
      );
      params.push(...votingMethods);
    }

    return (
      this.client.all(
        `
          select 
            manual_results.precinct_id as precinctId,
            manual_results.ballot_style_id as ballotStyleId,
            manual_results.voting_method as votingMethod,
            manual_results.ballot_count as ballotCount,
            manual_results.contest_results as contestResultsData,
            datetime(manual_results.created_at, 'localtime') as createdAt
          from manual_results
          inner join ballot_styles on
            manual_results.election_id = ballot_styles.election_id and 
            manual_results.ballot_style_id = ballot_styles.id
          where ${whereParts.join(' and ')}
        `,
        ...params
      ) as Array<
        ManualResultsIdentifier & {
          contestResultsData: string;
          ballotCount: number;
          createdAt: string;
        }
      >
    ).map((row) => ({
      precinctId: row.precinctId,
      ballotStyleId: row.ballotStyleId,
      votingMethod: row.votingMethod,
      manualResults: {
        ballotCount: row.ballotCount,
        contestResults: JSON.parse(
          row.contestResultsData
        ) as Tabulation.ManualElectionResults['contestResults'],
      },
      createdAt: convertSqliteTimestampToIso8601(row.createdAt),
    }));
  }

  getManualResultsMetadata({
    electionId,
  }: {
    electionId: Id;
  }): ManualResultsMetadataRecord[] {
    return (
      this.client.all(
        `
          select 
            precinct_id as precinctId,
            ballot_style_id as ballotStyleId,
            voting_method as votingMethod,
            ballot_count as ballotCount,
            datetime(created_at, 'localtime') as createdAt
          from manual_results
          where election_id = ?
        `,
        electionId
      ) as Array<
        ManualResultsIdentifier & {
          ballotCount: number;
          createdAt: string;
        }
      >
    ).map((row) => ({
      precinctId: row.precinctId,
      ballotStyleId: row.ballotStyleId,
      votingMethod: row.votingMethod,
      ballotCount: row.ballotCount,
      createdAt: convertSqliteTimestampToIso8601(row.createdAt),
    }));
  }

  /**
   * Sets whether the election with the given ID has had results marked official.
   */
  setElectionResultsOfficial(electionId: Id, isOfficialResults: boolean): void {
    this.client.run(
      `
        update elections
        set is_official_results = ?
        where id = ?
      `,
      isOfficialResults ? 1 : 0,
      electionId
    );
  }

  /* c8 ignore start */
  getDebugSummary(): Map<string, number> {
    const tableNameRows = this.client.all(
      `select name from sqlite_schema where type='table' order by name;`
    ) as Array<{ name: string }>;

    return new Map<string, number>(
      tableNameRows.map(
        (row) =>
          [
            row.name,
            (
              this.client.one(`select count(*) as count from ${row.name}`) as {
                count: number;
              }
            ).count,
          ] as const
      )
    );
  }
  /* c8 ignore stop */
}
