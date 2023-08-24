import { electionSample } from '@votingworks/fixtures';
import {
  BallotStyle,
  CandidateContest,
  CandidateVote,
  Dictionary,
  getBallotStyle,
  getContests,
  YesNoVote,
} from '@votingworks/types';
import arrayUnique from 'array-unique';
import {
  generateTestDeckWriteIn,
  numBallotPositions,
  getTestDeckCandidateAtIndex,
  generateTestDeckBallots,
} from './election';

describe('numBallotPositions', () => {
  test('returns 2 for yes-no contests', () => {
    const yesNoContest = electionSample.contests[13];
    expect(numBallotPositions(yesNoContest)).toEqual(2);
  });

  test('returns correct count for candidate contest without write-in', () => {
    const contest = electionSample.contests[0] as CandidateContest;
    expect(numBallotPositions(contest)).toEqual(contest.candidates.length);
  });

  test('returns correct count for candidate contest with write-in', () => {
    const contest = electionSample.contests[8] as CandidateContest;
    expect(numBallotPositions(contest)).toEqual(
      contest.candidates.length + contest.seats
    );
  });
});

test('generateTestDeckWriteIn generates valid write-in candidate', () => {
  const testIndex = 0;
  const testDeckWriteIn = generateTestDeckWriteIn(testIndex);
  expect(testDeckWriteIn.isWriteIn).toEqual(true);
  expect(testDeckWriteIn.id).toEqual('write-in');
  expect(testDeckWriteIn.name).toEqual('WRITE-IN');
  expect(testDeckWriteIn.writeInIndex).toEqual(testIndex);
});

describe('getTestDeckCandidateAtIndex', () => {
  test('returns candidate if index is less than number of candidates', () => {
    const contest = electionSample.contests[0] as CandidateContest;
    expect(getTestDeckCandidateAtIndex(contest, 0)).toEqual(
      contest.candidates[0]
    );
  });

  test('returns test deck write in if allowed and in range', () => {
    const contest = electionSample.contests[8] as CandidateContest;
    const candidate = getTestDeckCandidateAtIndex(
      contest,
      contest.candidates.length
    );
    expect(candidate.id).toEqual('write-in');
    expect(candidate.isWriteIn).toEqual(true);
    expect(candidate.writeInIndex).toEqual(0);
  });

  test('throws error if index out of bounds', () => {
    const contest = electionSample.contests[0] as CandidateContest;
    expect(() => {
      getTestDeckCandidateAtIndex(contest, contest.candidates.length);
    }).toThrowError();
  });
});

describe('generateTestDeckBallots', () => {
  test('generates a list of ballots with a vote for every ballot choice', () => {
    // Precinct with id '23' has one ballot style, with id '12', representing
    // races for 'district-2'
    const ballots = generateTestDeckBallots({
      election: electionSample,
      precinctId: '23',
      markingMethod: 'hand',
    });
    const votes = ballots.map((b) => b.votes);
    const ballotStyle = getBallotStyle({
      ballotStyleId: '12',
      election: electionSample,
    }) as BallotStyle;
    const contests = getContests({ ballotStyle, election: electionSample });

    const allSelections: Dictionary<string[]> = {};
    for (const contest of contests) {
      if (contest.type === 'yesno') {
        allSelections[contest.id] = arrayUnique(
          votes.flatMap((vote) => vote[contest.id] as YesNoVote)
        );
      } else if (contest.type === 'candidate') {
        const allCandidateVotes = votes.flatMap(
          (vote) => vote[contest.id] as CandidateVote
        );

        allSelections[contest.id] = arrayUnique(
          allCandidateVotes.map((candidate) => {
            if (candidate.id === 'write-in') {
              return `write-in-${candidate.writeInIndex}`;
            }
            return candidate.id;
          })
        );
      }
    }
    expect(allSelections).toMatchObject({
      senator: [
        'weiford',
        'garriss',
        'wentworthfarthington',
        'hewetson',
        'martinez',
        'brown',
        'pound',
      ],
      governor: [
        'franz',
        'harris',
        'bargmann',
        'abcock',
        'steelloy',
        'sharp',
        'wallace',
        'williams',
        'sharp-althea',
        'alpern',
        'windbeck',
        'greher',
        'alexander',
        'mitchell',
        'lee',
        'ash',
      ],
      'secretary-of-state': ['shamsi', 'talarico'],
      'county-commissioners': [
        'argent',
        'witherspoonsmithson',
        'bainbridge',
        'hennessey',
        'savoy',
        'tawa',
        'tawa-mary',
        'rangel',
        'altman',
        'moore',
        'schreiner',
        'write-in-0',
        'write-in-1',
        'write-in-2',
        'write-in-3',
      ],
      'city-mayor': ['white', 'seldon', 'write-in-0'],
      'city-council': [
        'eagle',
        'rupp',
        'shry',
        'barker',
        'davis',
        'smith',
        'write-in-0',
        'write-in-1',
        'write-in-2',
      ],
      'judicial-elmer-hull': ['yes', 'no'],
      'question-c': ['yes', 'no'],
      'measure-101': ['yes', 'no'],
    });
  });
});
