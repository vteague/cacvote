import {
  electionSampleDefinition,
  sampleBallotImages,
} from '@votingworks/fixtures';
import {
  AdjudicationReason,
  BallotIdSchema,
  BallotMetadataSchema,
  BallotType,
  BlankPage,
  ElectionDefinition,
  InterpretedBmdPage,
  InterpretedHmpbPage,
  PageInterpretation,
  UnreadablePage,
  safeParseJson,
  unsafeParse,
} from '@votingworks/types';
import {
  ALL_PRECINCTS_SELECTION,
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
  singlePrecinctSelectionFor,
} from '@votingworks/utils';
import { readFile, emptyDirSync } from 'fs-extra';
import { join } from 'path';
import {
  detectQrcodeInFilePath,
  interpretMultiPagePdfTemplate,
} from '@votingworks/ballot-interpreter-vx';
import { throwIllegalValue } from '@votingworks/basics';
import * as choctaw2020Fixtures from '../test/fixtures/2020-choctaw';
import * as stateOfHamiltonFixtures from '../test/fixtures/state-of-hamilton';
import * as msDemoFixtures from '../test/fixtures/election-b0260b4e-mississippi-demo';
import { Interpreter, sheetRequiresAdjudication } from './interpreter';

// mock SKIP_SCAN_ELECTION_HASH_CHECK to allow us to use old ballot image fixtures
const featureFlagMock = getFeatureFlagMock();
jest.mock('@votingworks/utils', () => {
  return {
    ...jest.requireActual('@votingworks/utils'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});
beforeEach(() => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_SCAN_ELECTION_HASH_CHECK
  );
});
afterEach(() => {
  featureFlagMock.resetFeatureFlags();
});

const interpreterOutputPath = join(__dirname, '..', 'test-output-dir/');
emptyDirSync(interpreterOutputPath);

test('extracts votes encoded in a QR code', async () => {
  const ballotImagePath = sampleBallotImages.sampleBatch1Ballot1.asFilePath();
  expect(
    (
      await new Interpreter({
        electionDefinition: {
          ...electionSampleDefinition,
          election: {
            ...electionSampleDefinition.election,
            markThresholds: { definite: 0.2, marginal: 0.17 },
          },
        },
        precinctSelection: ALL_PRECINCTS_SELECTION,
        testMode: true,
        adjudicationReasons:
          electionSampleDefinition.election.centralScanAdjudicationReasons ??
          [],
      }).interpretFile({
        ballotImagePath,
        detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
      })
    ).interpretation
  ).toMatchInlineSnapshot(`
    Object {
      "ballotId": undefined,
      "metadata": Object {
        "ballotStyleId": "12",
        "ballotType": 0,
        "electionHash": "b52e9f4728bb34e7ff48",
        "isTestMode": true,
        "locales": Object {
          "primary": "en-US",
        },
        "precinctId": "23",
      },
      "type": "InterpretedBmdPage",
      "votes": Object {
        "president": Array [
          Object {
            "id": "cramer-vuocolo",
            "name": "Adam Cramer and Greg Vuocolo",
            "partyIds": Array [
              "1",
            ],
          },
        ],
      },
    }
  `);
});

// TODO(jonah): This test used to pass using the precinct scanner interpreter
// wrapper, but when I converted it to use the Interpreter directly, it failed.
test.skip('properly scans a BMD ballot with a phantom QR code on back', async () => {
  const { electionDefinition, page2 } = msDemoFixtures;
  const interpreter = new Interpreter({
    electionDefinition,
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: true,
    adjudicationReasons:
      electionDefinition.election.centralScanAdjudicationReasons ?? [],
  });

  const { interpretation } = await interpreter.interpretFile({
    ballotImagePath: page2,
    detectQrcodeResult: await detectQrcodeInFilePath(page2),
  });
  expect(interpretation.type).toEqual('BlankPage');
});

test('properly detects test ballot in live mode', async () => {
  const ballotImagePath = sampleBallotImages.sampleBatch1Ballot1.asFilePath();
  const interpretationResult = await new Interpreter({
    electionDefinition: {
      ...electionSampleDefinition,
      election: {
        ...electionSampleDefinition.election,
        markThresholds: { definite: 0.2, marginal: 0.17 },
      },
    },
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: false, // this is the test mode
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  }).interpretFile({
    ballotImagePath,
    detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
  });

  expect(interpretationResult.interpretation.type).toEqual(
    'InvalidTestModePage'
  );
});

test('properly detects bmd ballot with wrong precinct', async () => {
  const ballotImagePath = sampleBallotImages.sampleBatch1Ballot1.asFilePath();
  const interpretationResult = await new Interpreter({
    electionDefinition: {
      ...electionSampleDefinition,
      election: {
        ...electionSampleDefinition.election,
        markThresholds: { definite: 0.2, marginal: 0.17 },
      },
    },
    testMode: true,
    precinctSelection: singlePrecinctSelectionFor('20'),
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  }).interpretFile({
    ballotImagePath,
    detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
  });

  expect(interpretationResult.interpretation.type).toEqual(
    'InvalidPrecinctPage'
  );
});

test('properly detects bmd ballot with correct precinct', async () => {
  const ballotImagePath = sampleBallotImages.sampleBatch1Ballot1.asFilePath();
  const interpretationResult = await new Interpreter({
    electionDefinition: {
      ...electionSampleDefinition,
      election: {
        ...electionSampleDefinition.election,
        markThresholds: { definite: 0.2, marginal: 0.17 },
      },
    },
    testMode: true,
    precinctSelection: singlePrecinctSelectionFor('23'),
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  }).interpretFile({
    ballotImagePath,
    detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
  });

  expect(interpretationResult.interpretation.type).toEqual(
    'InterpretedBmdPage'
  );
});

test('properly detects a ballot with incorrect election hash', async () => {
  featureFlagMock.disableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_SCAN_ELECTION_HASH_CHECK
  );
  const ballotImagePath = sampleBallotImages.sampleBatch1Ballot1.asFilePath();
  const interpretationResult = await new Interpreter({
    electionDefinition: {
      ...electionSampleDefinition,
      election: {
        ...electionSampleDefinition.election,
        markThresholds: { definite: 0.2, marginal: 0.17 },
      },
    },
    testMode: true,
    precinctSelection: singlePrecinctSelectionFor('23'),
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  }).interpretFile({
    ballotImagePath,
    detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
  });

  expect(interpretationResult.interpretation.type).toEqual(
    'InvalidElectionHashPage'
  );
});

test('detects a blank page', async () => {
  const ballotImagePath = sampleBallotImages.blankPage.asFilePath();
  const interpretationResult = await new Interpreter({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: true,
    adjudicationReasons: [],
  }).interpretFile({
    ballotImagePath,
    detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
  });

  expect(interpretationResult.interpretation.type).toEqual('BlankPage');
});

test('interprets marks on a HMPB', async () => {
  const interpreter = new Interpreter({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: false,
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  });

  const layouts = interpretMultiPagePdfTemplate({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    ballotPdfData: await readFile(stateOfHamiltonFixtures.ballotPdf),
    metadata: safeParseJson(
      await readFile(stateOfHamiltonFixtures.filledInPage1Metadata, 'utf8'),
      BallotMetadataSchema
    ).unsafeUnwrap(),
  });
  for await (const layout of layouts) {
    interpreter.addHmpbTemplate(layout);

    if (layout.ballotPageLayout.metadata.pageNumber === 1) {
      break;
    }
  }

  const ballotImagePath = stateOfHamiltonFixtures.filledInPage1;
  const { votes } = (
    await interpreter.interpretFile({
      ballotImagePath,
      detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
    })
  ).interpretation as InterpretedHmpbPage;

  expect(votes).toMatchInlineSnapshot(`
    Object {
      "president": Array [
        Object {
          "id": "barchi-hallaren",
          "name": "Joseph Barchi and Joseph Hallaren",
          "partyIds": Array [
            "0",
          ],
        },
      ],
      "representative-district-6": Array [
        Object {
          "id": "schott",
          "name": "Brad Schott",
          "partyIds": Array [
            "2",
          ],
        },
      ],
      "senator": Array [
        Object {
          "id": "brown",
          "name": "David Brown",
          "partyIds": Array [
            "6",
          ],
        },
      ],
    }
  `);
});

test('interprets marks on an upside-down HMPB', async () => {
  const interpreter = new Interpreter({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: false,
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  });

  const layouts = interpretMultiPagePdfTemplate({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    ballotPdfData: await readFile(stateOfHamiltonFixtures.ballotPdf),
    metadata: safeParseJson(
      await readFile(stateOfHamiltonFixtures.filledInPage1Metadata, 'utf8'),
      BallotMetadataSchema
    ).unsafeUnwrap(),
  });
  for await (const layout of layouts) {
    interpreter.addHmpbTemplate(layout);

    if (layout.ballotPageLayout.metadata.pageNumber === 1) {
      break;
    }
  }

  const ballotImagePath = stateOfHamiltonFixtures.filledInPage1Flipped;
  expect(
    (
      await interpreter.interpretFile({
        ballotImagePath,
        detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
      })
    ).interpretation as InterpretedHmpbPage
  ).toMatchInlineSnapshot(`
    Object {
      "adjudicationInfo": Object {
        "enabledReasonInfos": Array [],
        "enabledReasons": Array [],
        "ignoredReasonInfos": Array [],
        "requiresAdjudication": false,
      },
      "markInfo": Object {
        "ballotSize": Object {
          "height": 1584,
          "width": 1224,
        },
        "marks": Array [
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 455,
              "y": 220,
            },
            "contestId": "president",
            "optionId": "barchi-hallaren",
            "score": 0.4644808743169399,
            "scoredOffset": Object {
              "x": 1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 219,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 221,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 455,
              "y": 313,
            },
            "contestId": "president",
            "optionId": "cramer-vuocolo",
            "score": 0,
            "scoredOffset": Object {
              "x": 1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 313,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 315,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 455,
              "y": 407,
            },
            "contestId": "president",
            "optionId": "court-blumhardt",
            "score": 0.02185792349726776,
            "scoredOffset": Object {
              "x": 1,
              "y": -1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 408,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 410,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 455,
              "y": 502,
            },
            "contestId": "president",
            "optionId": "boone-lian",
            "score": 0,
            "scoredOffset": Object {
              "x": 1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 502,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 504,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 455,
              "y": 574,
            },
            "contestId": "president",
            "optionId": "hildebrand-garritty",
            "score": 0.01912568306010929,
            "scoredOffset": Object {
              "x": 1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 573,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 575,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 454,
              "y": 667,
            },
            "contestId": "president",
            "optionId": "patterson-lariviere",
            "score": 0.005434782608695652,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 667,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 669,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 454,
              "y": 907,
            },
            "contestId": "senator",
            "optionId": "weiford",
            "score": 0.002717391304347826,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 907,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 909,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 454,
              "y": 978,
            },
            "contestId": "senator",
            "optionId": "garriss",
            "score": 0.00273224043715847,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 978,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 980,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 454,
              "y": 1047,
            },
            "contestId": "senator",
            "optionId": "wentworthfarthington",
            "score": 0.00546448087431694,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 1047,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 1049,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 454,
              "y": 1118,
            },
            "contestId": "senator",
            "optionId": "hewetson",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 1117,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 1119,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 454,
              "y": 1188,
            },
            "contestId": "senator",
            "optionId": "martinez",
            "score": 0.01366120218579235,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 1188,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 1190,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 455,
              "y": 1258,
            },
            "contestId": "senator",
            "optionId": "brown",
            "score": 0.3879781420765027,
            "scoredOffset": Object {
              "x": 1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 1257,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 1259,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 454,
              "y": 1327,
            },
            "contestId": "senator",
            "optionId": "pound",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 1327,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 1329,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 842,
              "y": 192,
            },
            "contestId": "representative-district-6",
            "optionId": "plunkard",
            "score": 0,
            "scoredOffset": Object {
              "x": 1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 841,
                "y": 192,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 843,
                "y": 194,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 841,
              "y": 262,
            },
            "contestId": "representative-district-6",
            "optionId": "reeder",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 262,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 264,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 842,
              "y": 331,
            },
            "contestId": "representative-district-6",
            "optionId": "schott",
            "score": 0.41847826086956524,
            "scoredOffset": Object {
              "x": 1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 331,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 333,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 841,
              "y": 402,
            },
            "contestId": "representative-district-6",
            "optionId": "tawney",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 841,
                "y": 402,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 843,
                "y": 404,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 842,
              "y": 472,
            },
            "contestId": "representative-district-6",
            "optionId": "forrest",
            "score": 0.002717391304347826,
            "scoredOffset": Object {
              "x": 1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 472,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 474,
              },
            },
            "type": "candidate",
          },
        ],
      },
      "metadata": Object {
        "ballotId": undefined,
        "ballotStyleId": "12",
        "ballotType": 0,
        "electionHash": "602c9b551d08a348c3e1",
        "isTestMode": false,
        "locales": Object {
          "primary": "en-US",
          "secondary": "es-US",
        },
        "pageNumber": 1,
        "precinctId": "23",
      },
      "type": "InterpretedHmpbPage",
      "votes": Object {
        "president": Array [
          Object {
            "id": "barchi-hallaren",
            "name": "Joseph Barchi and Joseph Hallaren",
            "partyIds": Array [
              "0",
            ],
          },
        ],
        "representative-district-6": Array [
          Object {
            "id": "schott",
            "name": "Brad Schott",
            "partyIds": Array [
              "2",
            ],
          },
        ],
        "senator": Array [
          Object {
            "id": "brown",
            "name": "David Brown",
            "partyIds": Array [
              "6",
            ],
          },
        ],
      },
    }
  `);
});

test('interprets marks in ballots', async () => {
  jest.setTimeout(15000);

  const electionDefinition: ElectionDefinition = {
    ...choctaw2020Fixtures.electionDefinition,
    election: {
      markThresholds: { definite: 0.2, marginal: 0.12 },
      ...choctaw2020Fixtures.election,
    },
  };
  const interpreter = new Interpreter({
    electionDefinition,
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: false,
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  });

  const layouts = interpretMultiPagePdfTemplate({
    electionDefinition: choctaw2020Fixtures.electionDefinition,
    ballotPdfData: await readFile(choctaw2020Fixtures.ballotPdf),
    metadata: {
      ballotStyleId: '1',
      precinctId: '6526',
      locales: { primary: 'en-US' },
      ballotType: BallotType.Standard,
      electionHash: choctaw2020Fixtures.electionDefinition.electionHash,
      isTestMode: false,
    },
  });
  for await (const layout of layouts) {
    interpreter.addHmpbTemplate(layout);
  }

  {
    const ballotImagePath = choctaw2020Fixtures.filledInPage1;
    const interpreted = await interpreter.interpretFile({
      ballotImagePath,
      detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
    });
    expect((interpreted.interpretation as InterpretedHmpbPage).votes)
      .toMatchInlineSnapshot(`
      Object {
        "1": Array [
          Object {
            "id": "1",
            "name": "Joe Biden",
            "partyIds": Array [
              "2",
            ],
          },
        ],
        "2": Array [
          Object {
            "id": "23",
            "name": "Jimmy Edwards",
            "partyIds": Array [
              "4",
            ],
          },
        ],
        "3": Array [
          Object {
            "id": "32",
            "name": "Trent Kelly",
            "partyIds": Array [
              "3",
            ],
          },
        ],
        "4": Array [
          Object {
            "id": "write-in-0",
            "isWriteIn": true,
            "name": "Write-In #1",
          },
        ],
      }
    `);
  }

  {
    const ballotImagePath = choctaw2020Fixtures.filledInPage2;
    expect(
      (
        (
          await interpreter.interpretFile({
            ballotImagePath,
            detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
          })
        ).interpretation as InterpretedHmpbPage
      ).votes
    ).toMatchInlineSnapshot(`
      Object {
        "flag-question": Array [
          "yes",
        ],
        "initiative-65": Array [
          "yes",
          "no",
        ],
        "initiative-65-a": Array [
          "yes",
        ],
        "runoffs-question": Array [
          "no",
        ],
      }
    `);
  }
});

test('returns metadata if the QR code is readable but the HMPB ballot is not', async () => {
  const interpreter = new Interpreter({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    precinctSelection: ALL_PRECINCTS_SELECTION,
    testMode: false,
    adjudicationReasons:
      electionSampleDefinition.election.centralScanAdjudicationReasons ?? [],
  });

  const layouts = interpretMultiPagePdfTemplate({
    electionDefinition: stateOfHamiltonFixtures.electionDefinition,
    ballotPdfData: await readFile(stateOfHamiltonFixtures.ballotPdf),
    metadata: safeParseJson(
      await readFile(stateOfHamiltonFixtures.filledInPage1Metadata, 'utf8'),
      BallotMetadataSchema
    ).unsafeUnwrap(),
  });
  for await (const layout of layouts) {
    interpreter.addHmpbTemplate(layout);

    if (layout.ballotPageLayout.metadata.pageNumber === 3) {
      break;
    }
  }

  const ballotImagePath = stateOfHamiltonFixtures.filledInPage3;
  expect(
    (
      await interpreter.interpretFile({
        ballotImagePath,
        detectQrcodeResult: await detectQrcodeInFilePath(ballotImagePath),
      })
    ).interpretation as UnreadablePage
  ).toMatchInlineSnapshot(`
    Object {
      "adjudicationInfo": Object {
        "enabledReasonInfos": Array [],
        "enabledReasons": Array [],
        "ignoredReasonInfos": Array [
          Object {
            "contestId": "county-commissioners",
            "expected": 4,
            "optionIds": Array [
              "argent",
              "altman",
              "write-in-2",
            ],
            "optionIndexes": Array [
              0,
              8,
              13,
            ],
            "type": "Undervote",
          },
          Object {
            "contestId": "county-registrar-of-wills",
            "expected": 1,
            "optionIds": Array [],
            "optionIndexes": Array [],
            "type": "Undervote",
          },
          Object {
            "contestId": "city-council",
            "expected": 3,
            "optionIds": Array [
              "rupp",
              "shry",
              "davis",
              "smith",
            ],
            "optionIndexes": Array [
              1,
              2,
              4,
              5,
            ],
            "type": "Overvote",
          },
        ],
        "requiresAdjudication": false,
      },
      "markInfo": Object {
        "ballotSize": Object {
          "height": 1584,
          "width": 1224,
        },
        "marks": Array [
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 69,
              "y": 220,
            },
            "contestId": "county-commissioners",
            "optionId": "argent",
            "score": 0.5163934426229508,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 219,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 221,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 289,
            },
            "contestId": "county-commissioners",
            "optionId": "witherspoonsmithson",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 289,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 291,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 69,
              "y": 360,
            },
            "contestId": "county-commissioners",
            "optionId": "bainbridge",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 360,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 362,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 69,
              "y": 430,
            },
            "contestId": "county-commissioners",
            "optionId": "hennessey",
            "score": 0.00546448087431694,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 429,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 431,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 499,
            },
            "contestId": "county-commissioners",
            "optionId": "savoy",
            "score": 0.002717391304347826,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 499,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 501,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 69,
              "y": 571,
            },
            "contestId": "county-commissioners",
            "optionId": "tawa",
            "score": 0.00546448087431694,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 570,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 572,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 69,
              "y": 639,
            },
            "contestId": "county-commissioners",
            "optionId": "tawa-mary",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 639,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 641,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 710,
            },
            "contestId": "county-commissioners",
            "optionId": "rangel",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 709,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 711,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 68,
              "y": 780,
            },
            "contestId": "county-commissioners",
            "optionId": "altman",
            "score": 0.5519125683060109,
            "scoredOffset": Object {
              "x": -1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 780,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 782,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 851,
            },
            "contestId": "county-commissioners",
            "optionId": "moore",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 850,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 852,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 920,
            },
            "contestId": "county-commissioners",
            "optionId": "schreiner",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 919,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 921,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 69,
              "y": 990,
            },
            "contestId": "county-commissioners",
            "optionId": "write-in-0",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 990,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 992,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 1045,
            },
            "contestId": "county-commissioners",
            "optionId": "write-in-1",
            "score": 0.002717391304347826,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 1045,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 1047,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 70,
              "y": 1102,
            },
            "contestId": "county-commissioners",
            "optionId": "write-in-2",
            "score": 0.505464480874317,
            "scoredOffset": Object {
              "x": 1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 69,
                "y": 1101,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 71,
                "y": 1103,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 69,
              "y": 1157,
            },
            "contestId": "county-commissioners",
            "optionId": "write-in-3",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 69,
                "y": 1156,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 71,
                "y": 1158,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 454,
              "y": 192,
            },
            "contestId": "county-registrar-of-wills",
            "optionId": "ramachandrani",
            "score": 0.00273224043715847,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 192,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 194,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 454,
              "y": 262,
            },
            "contestId": "county-registrar-of-wills",
            "optionId": "write-in-0",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 262,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 264,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 454,
              "y": 496,
            },
            "contestId": "city-mayor",
            "optionId": "white",
            "score": 0.00273224043715847,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 495,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 497,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 454,
              "y": 565,
            },
            "contestId": "city-mayor",
            "optionId": "seldon",
            "score": 0.587431693989071,
            "scoredOffset": Object {
              "x": 0,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 454,
                "y": 564,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 456,
                "y": 566,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 454,
              "y": 634,
            },
            "contestId": "city-mayor",
            "optionId": "write-in-0",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 454,
                "y": 634,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 456,
                "y": 636,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 842,
              "y": 242,
            },
            "contestId": "city-council",
            "optionId": "eagle",
            "score": 0.005434782608695652,
            "scoredOffset": Object {
              "x": 1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 241,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 243,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 840,
              "y": 311,
            },
            "contestId": "city-council",
            "optionId": "rupp",
            "score": 0.453804347826087,
            "scoredOffset": Object {
              "x": -1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 310,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 312,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 841,
              "y": 381,
            },
            "contestId": "city-council",
            "optionId": "shry",
            "score": 0.5355191256830601,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 841,
                "y": 381,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 843,
                "y": 383,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 841,
              "y": 451,
            },
            "contestId": "city-council",
            "optionId": "barker",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 451,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 453,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 840,
              "y": 522,
            },
            "contestId": "city-council",
            "optionId": "davis",
            "score": 0.5081967213114754,
            "scoredOffset": Object {
              "x": -1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 841,
                "y": 522,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 843,
                "y": 524,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 842,
              "y": 592,
            },
            "contestId": "city-council",
            "optionId": "smith",
            "score": 0.5300546448087432,
            "scoredOffset": Object {
              "x": 1,
              "y": 1,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 841,
                "y": 591,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 843,
                "y": 593,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 840,
              "y": 661,
            },
            "contestId": "city-council",
            "optionId": "write-in-0",
            "score": 0,
            "scoredOffset": Object {
              "x": -1,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 661,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 663,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 21,
              "width": 32,
              "x": 841,
              "y": 717,
            },
            "contestId": "city-council",
            "optionId": "write-in-1",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 21,
                "width": 32,
                "x": 841,
                "y": 717,
              },
              "inner": Object {
                "height": 17,
                "width": 28,
                "x": 843,
                "y": 719,
              },
            },
            "type": "candidate",
          },
          Object {
            "bounds": Object {
              "height": 22,
              "width": 32,
              "x": 841,
              "y": 772,
            },
            "contestId": "city-council",
            "optionId": "write-in-2",
            "score": 0,
            "scoredOffset": Object {
              "x": 0,
              "y": 0,
            },
            "target": Object {
              "bounds": Object {
                "height": 22,
                "width": 32,
                "x": 841,
                "y": 772,
              },
              "inner": Object {
                "height": 18,
                "width": 28,
                "x": 843,
                "y": 774,
              },
            },
            "type": "candidate",
          },
        ],
      },
      "metadata": Object {
        "ballotId": undefined,
        "ballotStyleId": "12",
        "ballotType": 0,
        "electionHash": "602c9b551d08a348c3e1",
        "isTestMode": false,
        "locales": Object {
          "primary": "en-US",
          "secondary": "es-US",
        },
        "pageNumber": 3,
        "precinctId": "23",
      },
      "type": "InterpretedHmpbPage",
      "votes": Object {
        "city-council": Array [
          Object {
            "id": "rupp",
            "name": "Randall Rupp",
            "partyIds": Array [
              "0",
            ],
          },
          Object {
            "id": "shry",
            "name": "Carroll Shry",
            "partyIds": Array [
              "0",
            ],
          },
          Object {
            "id": "davis",
            "name": "Donald Davis",
            "partyIds": Array [
              "1",
            ],
          },
          Object {
            "id": "smith",
            "name": "Hugo Smith",
            "partyIds": Array [
              "1",
            ],
          },
        ],
        "city-mayor": Array [
          Object {
            "id": "seldon",
            "name": "Gregory Seldon",
            "partyIds": Array [
              "2",
            ],
          },
        ],
        "county-commissioners": Array [
          Object {
            "id": "argent",
            "name": "Camille Argent",
            "partyIds": Array [
              "0",
            ],
          },
          Object {
            "id": "altman",
            "name": "Valarie Altman",
            "partyIds": Array [
              "3",
            ],
          },
          Object {
            "id": "write-in-2",
            "isWriteIn": true,
            "name": "Write-In #3",
          },
        ],
      },
    }
  `);
});

const pageInterpretationBoilerplate: InterpretedHmpbPage = {
  type: 'InterpretedHmpbPage',
  metadata: {
    ballotStyleId: '12',
    ballotType: 0,
    electionHash: stateOfHamiltonFixtures.electionDefinition.electionHash,
    isTestMode: false,
    locales: {
      primary: 'en-US',
    },
    pageNumber: 3,
    precinctId: '23',
  },
  markInfo: {
    ballotSize: {
      height: 1584,
      width: 1224,
    },
    marks: [
      {
        type: 'candidate',
        bounds: {
          height: 20,
          width: 31,
          x: 451,
          y: 645,
        },
        contestId: 'contest-id',
        target: {
          bounds: {
            height: 20,
            width: 31,
            x: 451,
            y: 645,
          },
          inner: {
            height: 16,
            width: 27,
            x: 453,
            y: 647,
          },
        },
        optionId: '42',
        score: 0.8,
        scoredOffset: { x: 0, y: 0 },
      },
    ],
  },
  votes: {},
  adjudicationInfo: {
    ignoredReasonInfos: [],
    enabledReasonInfos: [],
    enabledReasons: [],
    requiresAdjudication: false,
  },
};

function withPageNumber(
  page: PageInterpretation,
  pageNumber: number
): PageInterpretation {
  switch (page.type) {
    case 'BlankPage':
    case 'InterpretedBmdPage':
    case 'InvalidElectionHashPage':
    case 'UnreadablePage':
      return page;

    case 'InterpretedHmpbPage':
      return { ...page, metadata: { ...page.metadata, pageNumber } };

    case 'InvalidPrecinctPage':
    case 'InvalidTestModePage':
      if ('pageNumber' in page.metadata) {
        return { ...page, metadata: { ...page.metadata, pageNumber } };
      }
      return page;

    default:
      throwIllegalValue(page, 'type');
  }
}

test('sheetRequiresAdjudication triggers if front or back requires adjudication', () => {
  const sideYes: InterpretedHmpbPage = {
    ...pageInterpretationBoilerplate,
    adjudicationInfo: {
      ...pageInterpretationBoilerplate.adjudicationInfo,
      enabledReasonInfos: [
        {
          type: AdjudicationReason.Overvote,
          contestId: '42',
          optionIds: ['27', '28'],
          optionIndexes: [0, 1],
          expected: 1,
        },
      ],
      ignoredReasonInfos: [],
      requiresAdjudication: true,
    },
  };

  const sideNo: InterpretedHmpbPage = {
    ...pageInterpretationBoilerplate,
    adjudicationInfo: {
      ...pageInterpretationBoilerplate.adjudicationInfo,
      requiresAdjudication: false,
    },
  };

  expect(
    sheetRequiresAdjudication([
      withPageNumber(sideYes, 1),
      withPageNumber(sideNo, 2),
    ])
  ).toEqual(true);
  expect(
    sheetRequiresAdjudication([
      withPageNumber(sideNo, 1),
      withPageNumber(sideYes, 2),
    ])
  ).toEqual(true);
  expect(
    sheetRequiresAdjudication([
      withPageNumber(sideYes, 1),
      withPageNumber(sideYes, 2),
    ])
  ).toEqual(true);
  expect(
    sheetRequiresAdjudication([
      withPageNumber(sideNo, 1),
      withPageNumber(sideNo, 2),
    ])
  ).toEqual(false);
});

test('sheetRequiresAdjudication triggers for HMPB/blank page', () => {
  const hmpbNoVotes: InterpretedHmpbPage = {
    ...pageInterpretationBoilerplate,
    adjudicationInfo: {
      requiresAdjudication: true,
      enabledReasons: [AdjudicationReason.BlankBallot],
      enabledReasonInfos: [{ type: AdjudicationReason.BlankBallot }],
      ignoredReasonInfos: [],
    },
  };

  const blank: BlankPage = {
    type: 'BlankPage',
  };

  const hmpbWithVotes: InterpretedHmpbPage = {
    ...pageInterpretationBoilerplate,
    adjudicationInfo: {
      requiresAdjudication: false,
      enabledReasons: [],
      enabledReasonInfos: [],
      ignoredReasonInfos: [],
    },
  };

  expect(sheetRequiresAdjudication([hmpbNoVotes, hmpbNoVotes])).toEqual(true);
  expect(
    sheetRequiresAdjudication([
      withPageNumber(hmpbNoVotes, 1),
      withPageNumber(hmpbWithVotes, 2),
    ])
  ).toEqual(false);
  expect(
    sheetRequiresAdjudication([
      withPageNumber(hmpbWithVotes, 1),
      withPageNumber(hmpbWithVotes, 2),
    ])
  ).toEqual(false);

  expect(sheetRequiresAdjudication([hmpbNoVotes, blank])).toEqual(true);
  expect(sheetRequiresAdjudication([blank, hmpbNoVotes])).toEqual(true);

  expect(sheetRequiresAdjudication([hmpbWithVotes, blank])).toEqual(true);
  expect(sheetRequiresAdjudication([blank, hmpbWithVotes])).toEqual(true);

  expect(sheetRequiresAdjudication([blank, blank])).toEqual(true);
});

test('sheetRequiresAdjudication is happy with a BMD ballot', () => {
  const bmd: InterpretedBmdPage = {
    type: 'InterpretedBmdPage',
    ballotId: unsafeParse(BallotIdSchema, '42'),
    metadata: {
      electionHash: '41',
      precinctId: '12',
      ballotStyleId: '1',
      locales: {
        primary: 'en-US',
      },
      isTestMode: true,
      ballotType: 0,
    },
    votes: {},
  };

  const unreadable: UnreadablePage = {
    type: 'UnreadablePage',
    reason:
      'cause there were a few too many black pixels so it was not filtered',
  };

  const blank: BlankPage = {
    type: 'BlankPage',
  };

  expect(sheetRequiresAdjudication([bmd, unreadable])).toEqual(false);
  expect(sheetRequiresAdjudication([unreadable, bmd])).toEqual(false);
  expect(sheetRequiresAdjudication([bmd, blank])).toEqual(false);
  expect(sheetRequiresAdjudication([blank, bmd])).toEqual(false);
});
