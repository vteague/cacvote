import { assert, assertDefined, find, range } from '@votingworks/basics';
import {
  electionSample,
  electionFamousNames2021Fixtures,
} from '@votingworks/fixtures';
import {
  AnyElement,
  gridPosition,
  layOutAllBallotStyles,
  measurements,
  Document,
  Rectangle,
  LayoutDensity,
  DEFAULT_LAYOUT_OPTIONS,
  BUBBLE_POSITIONS,
  LAYOUT_DENSITIES,
} from '@votingworks/hmpb-layout';
import {
  BallotPaperSize,
  BallotType,
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

export function voteToOptionId(vote: Vote[number]): Id {
  return typeof vote === 'string' ? vote : vote.id;
}

interface MarkBallotParams {
  ballot: Document;
  gridLayout: GridLayout;
  votes: VotesDict;
  paperSize: BallotPaperSize;
  layoutDensity: LayoutDensity;
}

export function markBallot({
  ballot,
  gridLayout,
  votes,
  paperSize,
  layoutDensity,
}: MarkBallotParams): Document {
  const m = measurements(paperSize, layoutDensity);
  function marksForPage(page: number): AnyElement[] {
    const sheetNumber = Math.ceil(page / 2);
    const side = page % 2 === 1 ? 'front' : 'back';
    const pagePositions = gridLayout.gridPositions.filter(
      (position) =>
        position.sheetNumber === sheetNumber && position.side === side
    );
    return Object.entries(votes).flatMap(([contestId, contestVotes]) => {
      if (!contestVotes) return [];
      const contestPositions = pagePositions.filter(
        (position) => position.contestId === contestId
      );
      if (contestPositions.length === 0) return []; // Contest not on this page
      return contestVotes?.map((vote): Rectangle => {
        const optionPosition = find(
          contestPositions,
          (position) =>
            position.type === 'option' &&
            position.optionId === voteToOptionId(vote)
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
  const { electionDefinition, ballots } = layOutAllBallotStyles({
    election: electionFamousNames2021Fixtures.election,
    ballotType: BallotType.Precinct,
    ballotMode: 'test',
    layoutOptions: DEFAULT_LAYOUT_OPTIONS,
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

  const markedBallot = markBallot({
    ballot,
    gridLayout,
    votes,
    paperSize: BallotPaperSize.Letter,
    layoutDensity: DEFAULT_LAYOUT_OPTIONS.layoutDensity,
  });

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

  for (const bubblePosition of BUBBLE_POSITIONS) {
    for (const paperSize of [BallotPaperSize.Letter, BallotPaperSize.Legal]) {
      for (const layoutDensity of LAYOUT_DENSITIES) {
        const election: Election = {
          ...electionSample,
          ballotLayout: {
            ...electionSample.ballotLayout,
            paperSize,
          },
        };

        const { ballots, electionDefinition } = layOutAllBallotStyles({
          election,
          ballotType: BallotType.Absentee,
          ballotMode: 'official',
          layoutOptions: {
            bubblePosition,
            layoutDensity,
          },
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
            return [
              contest.id,
              i % 2 === 0 ? [contest.yesOption.id] : [contest.noOption.id],
            ];
          })
        );

        const markedBallot = markBallot({
          ballot,
          gridLayout,
          votes,
          paperSize,
          layoutDensity,
        });

        const electionDir = join(
          sampleElectionDir,
          `${bubblePosition}-${paperSize}-${layoutDensity}`
        );

        // Saved PDFs generated by generate_fixtures.ts
        const blankBallotPath = join(electionDir, 'blank-ballot.pdf');
        const markedBallotPath = join(electionDir, 'marked-ballot.pdf');

        fixtures.push({
          bubblePosition,
          paperSize,
          density: layoutDensity,
          electionDefinition,
          precinctId,
          ballotStyleId: ballotStyle.id,
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
