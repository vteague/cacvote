import {
  Candidate,
  CandidateContest,
  CastVoteRecord,
  Contest,
  Election,
  VotesDict,
  getBallotStyle,
  getContests,
  Dictionary,
  FullElectionTally,
  TallyCategory,
  BatchTally,
  writeInCandidate,
  Tally,
  ContestTally,
  ContestOptionTally,
  ContestId,
  ContestTallyMeta,
} from '@votingworks/types';

import {
  assert,
  Optional,
  throwIllegalValue,
  find,
  typedAs,
} from '@votingworks/basics';
import {
  CastVoteRecordFilters,
  computeTallyWithPrecomputedCategories,
  ContestFilters,
  filterTalliesByParams,
  getEmptyTally,
  normalizeWriteInId,
} from './votes';

export interface ParseCastVoteRecordResult {
  cvr: CastVoteRecord;
  errors: string[];
  lineNumber: number;
}

// CVRs are newline-separated JSON objects
export function* parseCvrs(
  castVoteRecordsString: string,
  election: Election
): Generator<ParseCastVoteRecordResult> {
  const ballotStyleIds = new Set(election.ballotStyles.map(({ id }) => id));
  const precinctIds = new Set(election.precincts.map(({ id }) => id));
  const ballotStyleContests = new Set(
    election.ballotStyles.flatMap((ballotStyle) =>
      getContests({ ballotStyle, election }).map(
        ({ id }) => `${ballotStyle.id}/${id}`
      )
    )
  );

  const lines = castVoteRecordsString.split('\n');

  for (const [lineOffset, line] of lines.entries()) {
    if (line) {
      const cvr = JSON.parse(line) as CastVoteRecord;
      const errors: string[] = [];
      const {
        _ballotId,
        _ballotStyleId,
        _batchId,
        _batchLabel,
        // TODO: tally taking ballot type into account
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _ballotType,
        _precinctId,
        _testBallot,
        _scannerId,
        ...votes
      } = cvr;

      if (!ballotStyleIds.has(_ballotStyleId)) {
        errors.push(
          `Ballot style '${_ballotStyleId}' in CVR is not in the election definition`
        );
      }

      if (!precinctIds.has(_precinctId)) {
        errors.push(
          `Precinct '${_precinctId}' in CVR is not in the election definition`
        );
      }

      for (const contestId of Object.keys(votes as VotesDict)) {
        // let's ignore any fields that start with '_' for some level of
        // forwards-compatibility
        if (!contestId.startsWith('_')) {
          if (!ballotStyleContests.has(`${_ballotStyleId}/${contestId}`)) {
            errors.push(
              `Contest '${contestId}' in CVR is not in the election definition or is not a valid contest for ballot style '${_ballotStyleId}'`
            );
          } else {
            const selectedChoices = votes[contestId] as string[];
            const contest = find(election.contests, (c) => c.id === contestId);
            for (const selectedChoice of selectedChoices) {
              switch (contest.type) {
                case 'candidate': {
                  const isValidCandidate = contest.candidates
                    .map((c) => c.id)
                    .includes(selectedChoice);
                  const isValidWriteInCandidate =
                    contest.allowWriteIns &&
                    normalizeWriteInId(selectedChoice) === writeInCandidate.id;
                  if (!(isValidCandidate || isValidWriteInCandidate)) {
                    errors.push(
                      `Candidate ID '${selectedChoice}' in CVR is not a valid candidate choice for contest: '${contestId}'`
                    );
                  }
                  break;
                }
                case 'yesno': {
                  if (!['yes', 'no', ''].includes(selectedChoice)) {
                    errors.push(
                      `Choice '${selectedChoice}' in CVR is not a valid contest choice for yes no contest: ${contestId}`
                    );
                  }
                  break;
                }
                /* istanbul ignore next */
                default:
                  throwIllegalValue(contest, 'type');
              }
            }
          }
        }
      }

      if (typeof _testBallot !== 'boolean') {
        errors.push(
          `CVR test ballot flag must be true or false, got '${_testBallot}' (${typeof _testBallot}, not boolean)`
        );
      }

      if (_ballotId && typeof _ballotId !== 'string') {
        errors.push(
          `Ballot ID in CVR must be a string, got '${_ballotId}' (${typeof _ballotId}, not string)`
        );
      }

      if (typeof _scannerId !== 'string') {
        errors.push(
          `Scanner ID in CVR must be a string, got '${_scannerId}' (${typeof _scannerId}, not string)`
        );
      }

      if (typeof _batchId !== 'string' && typeof _batchId !== 'undefined') {
        errors.push(
          `Batch ID in CVR must be a string, got '${_batchId}' (${typeof _batchId}, not string)`
        );
      }

      if (
        typeof _batchLabel !== 'string' &&
        typeof _batchLabel !== 'undefined'
      ) {
        errors.push(
          `Batch label in CVR must be a string, got '${_batchLabel}' (${typeof _batchLabel}, not string)`
        );
      }

      yield { cvr, errors, lineNumber: lineOffset + 1 };
    }
  }
}

export function computeFullElectionTally(
  election: Election,
  castVoteRecords: ReadonlySet<CastVoteRecord>
): FullElectionTally {
  return computeTallyWithPrecomputedCategories(election, castVoteRecords, [
    TallyCategory.Batch,
    TallyCategory.Party,
    TallyCategory.Precinct,
    TallyCategory.Scanner,
    TallyCategory.VotingMethod,
  ]);
}

export function getEmptyFullElectionTally(): FullElectionTally {
  return {
    overallTally: getEmptyTally(),
    resultsByCategory: new Map(),
  };
}

export function filterTalliesByParamsAndBatchId(
  fullElectionTally: FullElectionTally,
  election: Election,
  batchId: string,
  {
    precinctId,
    scannerId,
    partyId,
    votingMethod,
  }: Omit<CastVoteRecordFilters, 'batchId'>,
  contestFilters?: ContestFilters
): BatchTally {
  const { resultsByCategory } = fullElectionTally;
  const batchTally = resultsByCategory.get(TallyCategory.Batch)?.[
    batchId
  ] as Optional<BatchTally>;
  const filteredTally = filterTalliesByParams(
    fullElectionTally,
    election,
    {
      precinctId,
      scannerId,
      partyId,
      votingMethod,
      batchId,
    },
    contestFilters
  );
  return typedAs<BatchTally>({
    ...filteredTally,
    batchLabel: batchTally?.batchLabel || '',
    scannerIds: batchTally?.scannerIds || [],
  });
}

//
// some different ideas on tabulation, starting with the overvote report
//

export interface Pair<T> {
  first: T;
  second: T;
}

function makePairs<T>(inputArray: T[]): Array<Pair<T>> {
  const pairs = [];
  for (let i = 0; i < inputArray.length; i += 1) {
    for (let j = i + 1; j < inputArray.length; j += 1) {
      const first = inputArray[i];
      const second = inputArray[j];
      if (!first || !second) {
        continue;
      }

      pairs.push({ first, second });
    }
  }

  return pairs;
}

export interface OvervotePairTally {
  candidates: Pair<Candidate>;
  tally: number;
}

export interface ContestOvervotePairTallies {
  contest: Contest;
  tallies: OvervotePairTally[];
}

function findOvervotePairTally(
  pairTallies: OvervotePairTally[],
  pair: Pair<Candidate>
): OvervotePairTally | undefined {
  for (const pairTally of pairTallies) {
    if (
      (pairTally.candidates.first === pair.first &&
        pairTally.candidates.second === pair.second) ||
      (pairTally.candidates.first === pair.second &&
        pairTally.candidates.second === pair.first)
    ) {
      return pairTally;
    }
  }

  return undefined;
}

// filters the CVR so it doesn't contain contests it shouldn't (TODO: should we cancel it altogether if it does?)
interface ProcessCastVoteRecordParams {
  election: Election;
  castVoteRecord: CastVoteRecord;
}

function processCastVoteRecord({
  election,
  castVoteRecord,
}: ProcessCastVoteRecordParams): CastVoteRecord | undefined {
  const ballotStyle = getBallotStyle({
    ballotStyleId: castVoteRecord._ballotStyleId,
    election,
  });
  assert(ballotStyle);
  if (!ballotStyle.precincts.includes(castVoteRecord._precinctId)) return;
  const contestIds = getContests({ ballotStyle, election }).map(
    (contest) => contest.id
  );
  const newCvr: CastVoteRecord = {
    _precinctId: castVoteRecord._precinctId,
    _ballotStyleId: castVoteRecord._ballotStyleId,
    _ballotType: castVoteRecord._ballotType,
    _ballotId: castVoteRecord._ballotId,
    _batchId: castVoteRecord._batchId,
    _batchLabel: castVoteRecord._batchLabel,
    _testBallot: castVoteRecord._testBallot,
    _scannerId: castVoteRecord._scannerId,
  };
  for (const key of contestIds) {
    if (castVoteRecord[key]) newCvr[key] = castVoteRecord[key];
  }
  return newCvr;
}

export function modifyTallyWithWriteInInfo(
  tally: Tally,
  officialCandidateWriteInCounts: Map<ContestId, Map<string, number>>,
  invalidWriteInCounts: Map<ContestId, number>
): Tally {
  const oldContestTallies = tally.contestTallies;
  const newContestTallies: Dictionary<ContestTally> = {};
  for (const contestId of Object.keys(oldContestTallies)) {
    if (!officialCandidateWriteInCounts.has(contestId)) {
      newContestTallies[contestId] = oldContestTallies[contestId];
      continue;
    }

    const writeInInfo = officialCandidateWriteInCounts.get(contestId);
    assert(writeInInfo);
    const oldContestTally = oldContestTallies[contestId];
    assert(oldContestTally);
    const oldCandidateTallies = oldContestTally.tallies;
    const newCandidateTallies: Dictionary<ContestOptionTally> = {};

    // add write-ins adjudicated for official candidates to their official
    // candidate counts
    let totalOfficialWriteInsForContest = 0;
    for (const candidateId of Object.keys(oldCandidateTallies)) {
      const oldCandidateTally = oldCandidateTallies[candidateId];
      assert(oldCandidateTally);
      if (!writeInInfo.has(candidateId)) {
        newCandidateTallies[candidateId] = {
          ...oldCandidateTally,
        };
      }
      const writeInsForCandidate = writeInInfo.get(candidateId) ?? 0;
      newCandidateTallies[candidateId] = {
        option: oldCandidateTally.option,
        tally: oldCandidateTally.tally + writeInsForCandidate,
      };
      totalOfficialWriteInsForContest += writeInsForCandidate;
    }

    const invalidWriteInCount = invalidWriteInCounts.get(contestId) ?? 0;

    // remove a) the write-in votes adjudicated for official candidates and b)
    // the write-in votes deemed invalid from the generic "Write-Ins" counts
    const writeInCandidateTally = oldCandidateTallies[writeInCandidate.id];
    assert(writeInCandidateTally);
    newCandidateTallies[writeInCandidate.id] = {
      option: writeInCandidateTally.option,
      tally:
        writeInCandidateTally.tally -
        totalOfficialWriteInsForContest -
        invalidWriteInCount,
    };

    // count invalid write-ins as undervotes
    const newContestMetadata: ContestTallyMeta = {
      ...oldContestTally.metadata,
      undervotes: oldContestTally.metadata.undervotes + invalidWriteInCount,
    };

    newContestTallies[contestId] = {
      ...oldContestTally,
      metadata: newContestMetadata,
      tallies: newCandidateTallies,
    };
  }
  return {
    ...tally,
    contestTallies: newContestTallies,
  };
}

interface FullTallyParams {
  election: Election;
  castVoteRecords: CastVoteRecord[];
}

export function getOvervotePairTallies({
  election,
  castVoteRecords,
}: FullTallyParams): Dictionary<ContestOvervotePairTallies> {
  const overvotePairTallies: Dictionary<ContestOvervotePairTallies> =
    election.contests
      .filter((contest) => contest.type === 'candidate')
      .reduce(
        (result, contest) => ({
          ...result,
          [contest.id]: { contest, tallies: [] },
        }),
        {}
      );

  for (const cvr of castVoteRecords) {
    const safeCvr = processCastVoteRecord({ election, castVoteRecord: cvr });
    if (!safeCvr) continue;

    for (const contestId of Object.keys(safeCvr)) {
      const contestOvervotePairTallies = overvotePairTallies[contestId];
      if (!contestOvervotePairTallies) continue;

      const candidateContest =
        contestOvervotePairTallies.contest as CandidateContest;
      const selected = safeCvr[contestId] as string[];

      if (!selected || selected.length <= candidateContest.seats) continue;

      const candidates = candidateContest.candidates.filter((c) =>
        selected.includes(c.id)
      );
      const overvotePairs = makePairs(candidates);

      for (const pair of overvotePairs) {
        let pairTally = findOvervotePairTally(
          contestOvervotePairTallies.tallies,
          pair
        );
        if (!pairTally) {
          pairTally = { candidates: pair, tally: 0 };
          contestOvervotePairTallies.tallies.push(pairTally);
        }

        pairTally.tally += 1;
      }
    }
  }

  return overvotePairTallies;
}
