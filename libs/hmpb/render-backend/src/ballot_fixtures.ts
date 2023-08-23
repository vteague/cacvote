import {
  assert,
  assertDefined,
  find,
  range,
  throwIllegalValue,
} from '@votingworks/basics';
import {
  electionSample,
  electionFamousNames2021Fixtures,
} from '@votingworks/fixtures';
import {
  AnyElement,
  gridPosition,
  layOutAllBallots,
  measurements,
  Document,
  Rectangle,
} from '@votingworks/hmpb-layout';
import {
  AnyContest,
  BallotPaperSize,
  BallotTargetMarkPosition,
  Contests,
  Election,
  getBallotStyle,
  getContests,
  GridLayout,
  Id,
  Vote,
  VotesDict,
} from '@votingworks/types';
import { join } from 'path';

export const fixturesDir = join(__dirname, '../fixtures');
export const famousNamesDir = join(fixturesDir, 'famous-names');
export const sampleElectionDir = join(fixturesDir, 'sample-election');

export function voteToOptionId(vote: Vote[number], contest: AnyContest): Id {
  switch (contest.type) {
    case 'candidate': {
      assert(typeof vote === 'object');
      return vote.id;
    }
    case 'yesno':
      return vote === 'yes' ? contest.yesOption.id : contest.noOption.id;
    default:
      throwIllegalValue(contest);
  }
}

export function markBallot(
  ballot: Document,
  gridLayout: GridLayout,
  votesToMark: VotesDict,
  contests: Contests,
  layoutSettings: {
    paperSize: BallotPaperSize;
    density: number;
  }
): Document {
  const m = measurements(layoutSettings.paperSize, layoutSettings.density);
  function marksForPage(page: number): AnyElement[] {
    const sheetNumber = Math.ceil(page / 2);
    const side = page % 2 === 1 ? 'front' : 'back';
    const pagePositions = gridLayout.gridPositions.filter(
      (position) =>
        position.sheetNumber === sheetNumber && position.side === side
    );
    return Object.entries(votesToMark).flatMap(([contestId, votes]) => {
      if (!votes) return [];
      const contestPositions = pagePositions.filter(
        (position) => position.contestId === contestId
      );
      if (contestPositions.length === 0) return []; // Contest not on this page
      return votes?.map((vote): Rectangle => {
        const optionPosition = find(
          contestPositions,
          (position) =>
            position.type === 'option' &&
            position.optionId ===
              voteToOptionId(
                vote,
                find(contests, (c) => c.id === contestId)
              )
        );
        // Add offset to get bubble center (since interpreter indexes from
        // timing marks, while layout indexes from ballot edge)
        const position = gridPosition(
          {
            column: optionPosition.column + 1,
            row: optionPosition.row + 1,
          },
          m
        );
        return {
          type: 'Rectangle',
          // Offset by half mark width/height
          x: position.x - 5,
          y: position.y - 4,
          width: 10,
          height: 8,
          fill: 'black',
        };
      });
    });
  }
  return {
    ...ballot,
    pages: ballot.pages.map((page, i) => ({
      ...page,
      children: page.children.concat(marksForPage(i + 1)),
    })),
  };
}

export const famousNamesFixtures = (() => {
  const { electionDefinition, ballots } = layOutAllBallots({
    election: electionFamousNames2021Fixtures.election,
    isTestMode: true,
  }).unsafeUnwrap();

  const { precinctId, document: ballot, gridLayout } = ballots[0];

  const votes: VotesDict = Object.fromEntries(
    electionDefinition.election.contests.map((contest, i) => {
      assert(contest.type === 'candidate');
      const candidates = range(0, contest.seats).map(
        (j) => contest.candidates[(i + j) % contest.candidates.length]
      );
      return [contest.id, candidates];
    })
  );

  const markedBallot = markBallot(
    ballot,
    gridLayout,
    votes,
    electionDefinition.election.contests,
    {
      paperSize: BallotPaperSize.Letter,
      density: 0,
    }
  );

  // Saved PDFs generated by generate_fixtures.ts
  const blankBallotPath = join(famousNamesDir, 'blank-ballot.pdf');
  const markedBallotPath = join(famousNamesDir, 'marked-ballot.pdf');

  return {
    electionDefinition,
    precinctId,
    gridLayout,
    blankBallot: ballot,
    markedBallot,
    votes,
    blankBallotPath,
    markedBallotPath,
  };
})();

export const sampleElectionFixtures = (() => {
  const fixtures = [];

  for (const targetMarkPosition of Object.values(BallotTargetMarkPosition)) {
    for (const paperSize of [BallotPaperSize.Letter, BallotPaperSize.Legal]) {
      for (const density of [0, 1, 2]) {
        const election: Election = {
          ...electionSample,
          ballotLayout: {
            ...electionSample.ballotLayout,
            targetMarkPosition,
            paperSize,
          },
        };

        const { ballots, electionDefinition } = layOutAllBallots({
          election,
          isTestMode: true,
        }).unsafeUnwrap();

        // Has ballot measures
        const ballotStyle = assertDefined(
          getBallotStyle({ election, ballotStyleId: '5' })
        );
        const precinctId = assertDefined(ballotStyle.precincts[0]);
        const { document: ballot, gridLayout } = find(
          ballots,
          (b) =>
            b.precinctId === precinctId &&
            b.gridLayout.ballotStyleId === ballotStyle.id
        );

        const contests = getContests({ election, ballotStyle });
        const votes: VotesDict = Object.fromEntries(
          contests.map((contest, i) => {
            if (contest.type === 'candidate') {
              const candidates = range(0, contest.seats).map(
                (j) => contest.candidates[(i + j) % contest.candidates.length]
              );
              return [contest.id, candidates];
            }
            return [contest.id, i % 2 === 0 ? ['yes'] : ['no']];
          })
        );

        const markedBallot = markBallot(ballot, gridLayout, votes, contests, {
          paperSize,
          density,
        });

        const electionDir = join(
          sampleElectionDir,
          `${targetMarkPosition}-${paperSize}-${density}`
        );

        // Saved PDFs generated by generate_fixtures.ts
        const blankBallotPath = join(electionDir, 'blank-ballot.pdf');
        const markedBallotPath = join(electionDir, 'marked-ballot.pdf');

        fixtures.push({
          targetMarkPosition,
          paperSize,
          density,
          electionDefinition,
          precinctId,
          gridLayout,
          blankBallot: ballot,
          markedBallot,
          votes,
          electionDir,
          blankBallotPath,
          markedBallotPath,
        });
      }
    }
  }

  return fixtures;
})();
