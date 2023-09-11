import { ResultSheet } from '@votingworks/backend';
import { sleep, typedAs } from '@votingworks/basics';
import {
  AdjudicationReason,
  BallotMetadata,
  BallotType,
  CandidateContest,
  InterpretedHmpbPage,
  mapSheet,
  PageInterpretationWithFiles,
  safeParseSystemSettings,
  SheetOf,
  TEST_JURISDICTION,
  YesNoContest,
} from '@votingworks/types';
import {
  ALL_PRECINCTS_SELECTION,
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import * as tmp from 'tmp';
import { v4 as uuid } from 'uuid';
import {
  electionGridLayoutNewHampshireAmherstFixtures,
  electionTwoPartyPrimaryFixtures,
} from '@votingworks/fixtures';
import { sha256 } from 'js-sha256';
import { zeroRect } from '../test/fixtures/zero_rect';
import { Store } from './store';

// We pause in some of these tests so we need to increase the timeout
jest.setTimeout(20000);

const mockFeatureFlagger = getFeatureFlagMock();

jest.mock('@votingworks/utils', (): typeof import('@votingworks/utils') => {
  return {
    ...jest.requireActual('@votingworks/utils'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

const jurisdiction = TEST_JURISDICTION;

const testMetadata: BallotMetadata = {
  ballotStyleId: '12',
  ballotType: BallotType.Precinct,
  electionHash:
    electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
      .electionHash,
  isTestMode: false,
  precinctId: '23',
};

const testSheetWithFiles: SheetOf<PageInterpretationWithFiles> = [
  {
    imagePath: '/front.png',
    interpretation: {
      type: 'InterpretedHmpbPage',
      adjudicationInfo: {
        requiresAdjudication: false,
        enabledReasons: [],
        enabledReasonInfos: [],
        ignoredReasonInfos: [],
      },
      layout: {
        contests: [],
        metadata: { ...testMetadata, pageNumber: 1 },
        pageSize: { width: 0, height: 0 },
      },
      markInfo: {
        ballotSize: { height: 1000, width: 800 },
        marks: [],
      },
      metadata: { ...testMetadata, pageNumber: 1 },
      votes: {},
    },
  },
  {
    imagePath: '/back.png',
    interpretation: {
      type: 'InterpretedHmpbPage',
      adjudicationInfo: {
        requiresAdjudication: false,
        enabledReasons: [],
        enabledReasonInfos: [],
        ignoredReasonInfos: [],
      },
      layout: {
        contests: [],
        metadata: { ...testMetadata, pageNumber: 2 },
        pageSize: { width: 0, height: 0 },
      },
      markInfo: {
        ballotSize: { height: 1000, width: 800 },
        marks: [],
      },
      metadata: { ...testMetadata, pageNumber: 2 },
      votes: {},
    },
  },
];

test('get/set election', () => {
  const store = Store.memoryStore();

  expect(store.getElectionDefinition()).toBeUndefined();
  expect(store.hasElection()).toBeFalsy();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  expect(store.getElectionDefinition()?.election).toEqual(
    electionGridLayoutNewHampshireAmherstFixtures.election
  );
  expect(store.hasElection()).toBeTruthy();

  store.setElectionAndJurisdiction(undefined);
  expect(store.getElectionDefinition()).toBeUndefined();
});

test('get/set system settings', () => {
  const store = Store.memoryStore();

  expect(store.getSystemSettings()).toBeUndefined();
  const systemSettings = safeParseSystemSettings(
    electionTwoPartyPrimaryFixtures.systemSettings.asText()
  ).unsafeUnwrap();

  store.setSystemSettings(systemSettings);
  expect(store.getSystemSettings()).toEqual(systemSettings);
});

test('get/set test mode', () => {
  const store = Store.memoryStore();

  // Before setting an election
  expect(store.getTestMode()).toEqual(true);
  expect(() => store.setTestMode(false)).toThrowError();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // After setting an election
  expect(store.getTestMode()).toEqual(true);

  store.setTestMode(false);
  expect(store.getTestMode()).toEqual(false);

  store.setTestMode(true);
  expect(store.getTestMode()).toEqual(true);
});

test('get/set is sounds muted mode', () => {
  const store = Store.memoryStore();

  // Before setting an election
  expect(store.getIsSoundMuted()).toEqual(false);
  expect(() => store.setIsSoundMuted(true)).toThrowError();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // After setting an election
  expect(store.getIsSoundMuted()).toEqual(false);

  store.setIsSoundMuted(true);
  expect(store.getIsSoundMuted()).toEqual(true);

  store.setIsSoundMuted(false);
  expect(store.getIsSoundMuted()).toEqual(false);
});

test('get/set is ultrasonic disabled mode', () => {
  const store = Store.memoryStore();

  // Before setting an election
  expect(store.getIsUltrasonicDisabled()).toEqual(false);
  expect(() => store.setIsUltrasonicDisabled(true)).toThrowError();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // After setting an election
  expect(store.getIsUltrasonicDisabled()).toEqual(false);

  store.setIsUltrasonicDisabled(true);
  expect(store.getIsUltrasonicDisabled()).toEqual(true);

  store.setIsUltrasonicDisabled(false);
  expect(store.getIsUltrasonicDisabled()).toEqual(false);
});

test('get/set ballot count when ballot bag last replaced', () => {
  const store = Store.memoryStore();

  // Before setting an election
  expect(store.getBallotCountWhenBallotBagLastReplaced()).toEqual(0);
  expect(() =>
    store.setBallotCountWhenBallotBagLastReplaced(1500)
  ).toThrowError();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // After setting an election
  expect(store.getBallotCountWhenBallotBagLastReplaced()).toEqual(0);

  store.setBallotCountWhenBallotBagLastReplaced(1500);
  expect(store.getBallotCountWhenBallotBagLastReplaced()).toEqual(1500);
});

test('get/set precinct selection', () => {
  const store = Store.memoryStore();

  // Before setting an election
  expect(store.getPrecinctSelection()).toEqual(undefined);
  expect(() =>
    store.setPrecinctSelection(ALL_PRECINCTS_SELECTION)
  ).toThrowError();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // After setting an election
  expect(store.getPrecinctSelection()).toEqual(undefined);

  store.setPrecinctSelection(ALL_PRECINCTS_SELECTION);
  expect(store.getPrecinctSelection()).toEqual(ALL_PRECINCTS_SELECTION);

  const precinctSelection = singlePrecinctSelectionFor('precinct-1');
  store.setPrecinctSelection(precinctSelection);
  expect(store.getPrecinctSelection()).toMatchObject(precinctSelection);
});

test('get/set polls state', () => {
  const store = Store.memoryStore();

  // Before setting an election
  expect(store.getPollsState()).toEqual('polls_closed_initial');
  expect(() => store.setPollsState('polls_open')).toThrowError();

  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // After setting an election
  store.setPollsState('polls_open');
  expect(store.getPollsState()).toEqual('polls_open');
});

test('get/set scanner as backed up', () => {
  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  expect(store.getScannerBackupTimestamp()).toBeFalsy();
  store.setScannerBackedUp();
  expect(store.getScannerBackupTimestamp()).toBeTruthy();
  store.setScannerBackedUp(false);
  expect(store.getScannerBackupTimestamp()).toBeFalsy();
});

test('get/set cvrs as backed up', () => {
  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  expect(store.getCvrsBackupTimestamp()).toBeFalsy();
  store.setCvrsBackedUp();
  expect(store.getCvrsBackupTimestamp()).toBeTruthy();
  store.setCvrsBackedUp(false);
  expect(store.getCvrsBackupTimestamp()).toBeFalsy();
});

test('batch cleanup works correctly', () => {
  const dbFile = tmp.fileSync();
  const store = Store.fileStore(dbFile.name);

  store.reset();

  const firstBatchId = store.addBatch();
  store.addBatch();
  store.finishBatch({ batchId: firstBatchId });
  store.cleanupIncompleteBatches();

  const batches = store.getBatches();
  expect(batches).toHaveLength(1);
  expect(batches[0].id).toEqual(firstBatchId);
  expect(batches[0].batchNumber).toEqual(1);
  expect(batches[0].label).toEqual('Batch 1');

  const thirdBatchId = store.addBatch();
  store.addBatch();
  store.finishBatch({ batchId: thirdBatchId });
  store.cleanupIncompleteBatches();
  const updatedBatches = store.getBatches();
  expect(
    [...updatedBatches].sort((a, b) => a.label.localeCompare(b.label))
  ).toEqual([
    expect.objectContaining({
      id: firstBatchId,
      batchNumber: 1,
      label: 'Batch 1',
    }),
    expect.objectContaining({
      id: thirdBatchId,
      batchNumber: 3,
      label: 'Batch 3',
    }),
  ]);
});

test('getBatches', () => {
  const store = Store.memoryStore();

  // Create a batch and add a sheet to it
  const batchId = store.addBatch();
  const sheetId = store.addSheet(uuid(), batchId, [
    {
      imagePath: '/tmp/front-page.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);

  // Add a second sheet
  const sheetId2 = store.addSheet(uuid(), batchId, [
    {
      imagePath: '/tmp/front-page2.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page2.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);
  let batches = store.getBatches();
  expect(batches).toHaveLength(1);
  expect(batches[0].count).toEqual(2);

  // Delete one of the sheets
  store.deleteSheet(sheetId);
  batches = store.getBatches();
  expect(batches).toHaveLength(1);
  expect(batches[0].count).toEqual(1);

  // Delete the last sheet, then confirm that store.getBatches() results still include the batch
  store.deleteSheet(sheetId2);
  batches = store.getBatches();
  expect(batches).toHaveLength(1);
  expect(batches[0].count).toEqual(0);

  // Confirm that batches marked as deleted are not included
  store.deleteBatch(batchId);
  batches = store.getBatches();
  expect(batches).toHaveLength(0);
});

test('canUnconfigure in test mode', () => {
  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  store.setTestMode(true);

  // With an unexported batch, we should be able to unconfigure the machine in test mode
  store.addBatch();
  expect(store.getCanUnconfigure()).toEqual(true);
});

test('canUnconfigure not in test mode', async () => {
  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  store.setTestMode(false);

  // Can unconfigure if no batches added
  expect(store.getCanUnconfigure()).toEqual(true);

  // Create a batch
  const batchId = store.addBatch();

  // Can unconfigure if only empty batches added
  expect(store.getCanUnconfigure()).toEqual(true);

  // Cannot unconfigure after new sheet added
  const sheetId = store.addSheet(uuid(), batchId, [
    {
      imagePath: '/tmp/front-page.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);
  expect(store.getCanUnconfigure()).toEqual(false);
  store.setScannerBackedUp();
  expect(store.getCanUnconfigure()).toEqual(true);

  // Setup second batch with second sheet
  await sleep(1000);
  const batchId2 = store.addBatch();
  store.addSheet(uuid(), batchId2, [
    {
      imagePath: '/tmp/front-page2.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page2.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);
  expect(store.getCanUnconfigure()).toEqual(false);
  store.setScannerBackedUp();
  expect(store.getCanUnconfigure()).toEqual(true);

  // Setup third batch with third sheet
  await sleep(1000);
  const batchId3 = store.addBatch();
  const sheetId3 = store.addSheet(uuid(), batchId3, [
    {
      imagePath: '/tmp/front-page3.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page3.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);
  expect(store.getCanUnconfigure()).toEqual(false);
  store.setScannerBackedUp();
  expect(store.getCanUnconfigure()).toEqual(true);

  // Cannot unconfigure after sheet deleted
  await sleep(1000);
  store.deleteSheet(sheetId);
  expect(store.getCanUnconfigure()).toEqual(false);
  store.setScannerBackedUp();
  expect(store.getCanUnconfigure()).toEqual(true);

  // Can unconfigure after empty batch deleted
  await sleep(1000);
  store.deleteBatch(batchId);
  expect(store.getCanUnconfigure()).toEqual(true);

  // Cannot unconfigure after non-empty batch deleted
  await sleep(1000);
  store.deleteBatch(batchId2);
  expect(store.getCanUnconfigure()).toEqual(false);
  store.setScannerBackedUp();
  expect(store.getCanUnconfigure()).toEqual(true);

  // Can unconfigure if no counted ballots
  await sleep(1000);
  store.deleteSheet(sheetId3);
  expect(store.getCanUnconfigure()).toEqual(true);
});

test('getCanUnconfigure when continuous export is enabled', () => {
  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  store.setTestMode(false);
  const batchId = store.addBatch();
  store.addSheet(uuid(), batchId, testSheetWithFiles);

  expect(store.getCanUnconfigure()).toEqual(false);

  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.ENABLE_CONTINUOUS_EXPORT
  );

  expect(store.getCanUnconfigure()).toEqual(true);
});

test('adjudication', () => {
  const candidateContests =
    electionGridLayoutNewHampshireAmherstFixtures.election.contests.filter(
      (contest): contest is CandidateContest => contest.type === 'candidate'
    );
  const yesnoContests =
    electionGridLayoutNewHampshireAmherstFixtures.election.contests.filter(
      (contest): contest is YesNoContest => contest.type === 'yesno'
    );

  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });
  function fakePage(i: 0 | 1): PageInterpretationWithFiles {
    const metadata: BallotMetadata = {
      electionHash:
        electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
          .electionHash,
      ballotStyleId: 'card-number-3',
      precinctId: 'town-id-00701-precinct-id-',
      isTestMode: false,
      ballotType: BallotType.Precinct,
    };
    return {
      imagePath: i === 0 ? '/front.png' : '/back.png',
      interpretation: {
        type: 'InterpretedHmpbPage',
        votes: {},
        markInfo: {
          ballotSize: { width: 800, height: 1000 },
          marks: [
            {
              type: 'candidate',
              contestId: candidateContests[i].id,
              optionId: candidateContests[i].candidates[0].id,
              score: 0.12, // marginal
              scoredOffset: { x: 0, y: 0 },
              bounds: zeroRect,
              target: {
                bounds: zeroRect,
                inner: zeroRect,
              },
            },
            ...(yesnoContests[i]
              ? ([
                  {
                    type: 'yesno',
                    contestId: yesnoContests[i].id,
                    optionId: yesnoContests[i].yesOption.id,
                    score: 1, // definite
                    scoredOffset: { x: 0, y: 0 },
                    bounds: zeroRect,
                    target: {
                      bounds: zeroRect,
                      inner: zeroRect,
                    },
                  },
                ] as const)
              : []),
          ],
        },
        metadata: {
          ...metadata,
          pageNumber: 1,
        },
        adjudicationInfo: {
          requiresAdjudication: true,
          enabledReasons: [AdjudicationReason.MarginalMark],
          enabledReasonInfos: [
            {
              type: AdjudicationReason.MarginalMark,
              contestId: candidateContests[i].id,
              optionId: candidateContests[i].candidates[0].id,
              optionIndex: 0,
            },
            {
              type: AdjudicationReason.Undervote,
              contestId: candidateContests[i].id,
              expected: 1,
              optionIds: [],
              optionIndexes: [],
            },
          ],
          ignoredReasonInfos: [],
        },
        layout: {
          pageSize: { width: 0, height: 0 },
          metadata: {
            ...metadata,
            pageNumber: 1,
          },
          contests: [],
        },
      },
    };
  }
  const batchId = store.addBatch();
  const ballotId = store.addSheet(uuid(), batchId, [fakePage(0), fakePage(1)]);

  // check the review paths
  const reviewSheet = store.getNextAdjudicationSheet();
  expect(reviewSheet?.id).toEqual(ballotId);

  store.finishBatch({ batchId });

  // cleaning up batches now should have no impact
  store.cleanupIncompleteBatches();
});

test('iterating over all result sheets', () => {
  const store = Store.memoryStore();
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  // starts empty
  expect(Array.from(store.forEachResultSheet())).toEqual([]);

  // add a batch with a sheet
  const batchId = store.addBatch();
  store.addSheet(uuid(), batchId, testSheetWithFiles);
  store.finishBatch({ batchId });

  // has one sheet
  expect(Array.from(store.forEachResultSheet())).toEqual(
    typedAs<ResultSheet[]>([
      {
        id: expect.any(String),
        batchId,
        batchLabel: 'Batch 1',
        interpretation: mapSheet(
          testSheetWithFiles,
          (page) => page.interpretation
        ),
        frontImagePath: '/front.png',
        backImagePath: '/back.png',
      },
    ])
  );

  // delete the batch and the results are empty again
  store.deleteBatch(batchId);
  expect(Array.from(store.forEachResultSheet())).toEqual([]);

  // add a sheet requiring adjudication and check that it is not included
  const batchId2 = store.addBatch();
  store.addSheet(uuid(), batchId2, [
    {
      ...testSheetWithFiles[0],
      interpretation: {
        ...(testSheetWithFiles[0].interpretation as InterpretedHmpbPage),
        adjudicationInfo: {
          requiresAdjudication: true,
          enabledReasons: [AdjudicationReason.Overvote],
          enabledReasonInfos: [
            {
              type: AdjudicationReason.Overvote,
              contestId: 'contest-1',
              optionIds: ['candidate-1', 'candidate-2'],
              optionIndexes: [0, 1],
              expected: 1,
            },
          ],
          ignoredReasonInfos: [],
        },
      },
    },
    testSheetWithFiles[1],
  ]);
  expect(Array.from(store.forEachResultSheet())).toEqual([]);
});

test('getResultSheet', () => {
  const store = Store.memoryStore();

  const batchId = store.addBatch();
  const sheet1Id = uuid();
  const sheet2Id = uuid();
  store.addSheet(sheet1Id, batchId, testSheetWithFiles);
  store.addSheet(sheet2Id, batchId, [
    {
      ...testSheetWithFiles[0],
      interpretation: {
        ...(testSheetWithFiles[0].interpretation as InterpretedHmpbPage),
        adjudicationInfo: {
          requiresAdjudication: true,
          enabledReasons: [AdjudicationReason.Overvote],
          enabledReasonInfos: [],
          ignoredReasonInfos: [],
        },
      },
    },
    testSheetWithFiles[1],
  ]);

  expect(store.getResultSheet(sheet1Id)).toEqual(
    typedAs<ResultSheet>({
      id: sheet1Id,
      batchId,
      batchLabel: 'Batch 1',
      interpretation: mapSheet(
        testSheetWithFiles,
        (page) => page.interpretation
      ),
      frontImagePath: '/front.png',
      backImagePath: '/back.png',
    })
  );

  // Sheets requiring adjudication are not part of the "result" set
  expect(store.getResultSheet(sheet2Id)).toEqual(undefined);

  expect(store.getResultSheet('non-existent-id')).toEqual(undefined);

  store.deleteSheet(sheet1Id);
  expect(store.getResultSheet(sheet1Id)).toEqual(undefined);
});

test('resetElectionSession', () => {
  const dbFile = tmp.fileSync();
  const store = Store.fileStore(dbFile.name);
  store.setElectionAndJurisdiction({
    electionData:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    jurisdiction,
  });

  store.setPollsState('polls_open');
  store.setBallotCountWhenBallotBagLastReplaced(1500);

  store.addBatch();
  store.addBatch();
  expect(
    store
      .getBatches()
      .map((batch) => batch.label)
      .sort((a, b) => a.localeCompare(b))
  ).toEqual(['Batch 1', 'Batch 2']);

  store.setScannerBackedUp();
  store.setCvrsBackedUp();

  store.resetElectionSession();
  // resetElectionSession should reset election session state
  expect(store.getPollsState()).toEqual('polls_closed_initial');
  expect(store.getBallotCountWhenBallotBagLastReplaced()).toEqual(0);
  expect(store.getScannerBackupTimestamp()).toBeFalsy();
  expect(store.getCvrsBackupTimestamp()).toBeFalsy();
  // resetElectionSession should clear all batches
  expect(store.getBatches()).toEqual([]);

  // resetElectionSession should reset the autoincrement in the batch label
  store.addBatch();
  store.addBatch();
  expect(
    store
      .getBatches()
      .map((batch) => batch.label)
      .sort((a, b) => a.localeCompare(b))
  ).toEqual(['Batch 1', 'Batch 2']);
});

test('getBallotsCounted', () => {
  const store = Store.memoryStore();

  expect(store.getBallotsCounted()).toEqual(0);

  // Create a batch and add a sheet to it
  const batchId = store.addBatch();
  store.addSheet(uuid(), batchId, [
    {
      imagePath: '/tmp/front-page.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);

  expect(store.getBallotsCounted()).toEqual(1);
  store.finishBatch({ batchId });
  expect(store.getBallotsCounted()).toEqual(1);

  // Create a second batch and add a second and third sheet
  const batch2Id = store.addBatch();
  store.addSheet(uuid(), batch2Id, [
    {
      imagePath: '/tmp/front-page2.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page2.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);

  expect(store.getBallotsCounted()).toEqual(2);

  const sheetId3 = store.addSheet(uuid(), batch2Id, [
    {
      imagePath: '/tmp/front-page3.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
    {
      imagePath: '/tmp/back-page3.png',
      interpretation: {
        type: 'UnreadablePage',
      },
    },
  ]);

  expect(store.getBallotsCounted()).toEqual(3);
  store.finishBatch({ batchId: batch2Id });
  expect(store.getBallotsCounted()).toEqual(3);

  // Delete one of the sheets
  store.deleteSheet(sheetId3);
  expect(store.getBallotsCounted()).toEqual(2);

  // Delete one of the batches
  store.deleteBatch(batchId);
  expect(store.getBallotsCounted()).toEqual(1);
});

test('getExportDirectoryName and setExportDirectoryName', () => {
  const store = Store.memoryStore();

  const exportDirectoryName1 = 'TEST__machine_SCAN-0001__2023-08-16_17-02-24';
  const exportDirectoryName2 = 'TEST__machine_SCAN-0001__2023-08-16_23-10-01';

  expect(store.getExportDirectoryName()).toEqual(undefined);
  store.setExportDirectoryName(exportDirectoryName1);
  expect(store.getExportDirectoryName()).toEqual(exportDirectoryName1);
  store.setExportDirectoryName(exportDirectoryName2);
  expect(store.getExportDirectoryName()).toEqual(exportDirectoryName2);
});

test('getCastVoteRecordRootHash, updateCastVoteRecordHashes, and clearCastVoteRecordHashes', () => {
  const store = Store.memoryStore();

  // Just test that the store has been wired properly. Rely on libs/auth tests for more detailed
  // coverage of hashing logic.
  expect(store.getCastVoteRecordRootHash()).toEqual('');
  store.updateCastVoteRecordHashes(
    'abcd1234-0000-0000-0000-000000000000',
    sha256('')
  );
  expect(store.getCastVoteRecordRootHash()).toEqual(
    sha256(sha256(sha256(sha256(''))))
  );
  store.clearCastVoteRecordHashes();
  expect(store.getCastVoteRecordRootHash()).toEqual('');
});
