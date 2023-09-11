import {
  electionFamousNames2021Fixtures,
  electionTwoPartyPrimaryDefinition,
} from '@votingworks/fixtures';
import { fakeKiosk, fakePrinterInfo } from '@votingworks/test-utils';
import { fakeLogger, Logger } from '@votingworks/logging';
import { screen, within } from '@testing-library/react';

import { Route } from 'react-router-dom';
import { PartyId } from '@votingworks/types';
import { renderInAppContext } from '../../test/render_in_app_context';
import { ApiMock, createApiMock } from '../../test/helpers/mock_api_client';
import {
  AllPrecinctsTallyReportScreen,
  BatchTallyReportScreen,
  FullElectionTallyReportScreen,
  PartyTallyReportScreen,
  PrecinctTallyReportScreen,
  ScannerTallyReportScreen,
  VotingMethodTallyReportScreen,
} from './tally_report_screen';
import { routerPaths } from '../router_paths';
import { getSimpleMockTallyResults } from '../../test/helpers/mock_results';

let mockKiosk: jest.Mocked<KioskBrowser.Kiosk>;
let logger: Logger;
let apiMock: ApiMock;

beforeEach(() => {
  jest.useFakeTimers();
  mockKiosk = fakeKiosk();
  mockKiosk.getPrinterInfo.mockResolvedValue([
    fakePrinterInfo({ connected: true, name: 'VxPrinter' }),
  ]);
  window.kiosk = mockKiosk;
  logger = fakeLogger();
  apiMock = createApiMock();
});

afterEach(() => {
  delete window.kiosk;
  apiMock.assertComplete();
});

async function checkReportSection({
  testId,
  title,
  subtitle,
  ballotCount,
  contestCount,
}: {
  testId: string;
  title: string;
  subtitle?: string;
  ballotCount: number;
  contestCount?: number;
}): Promise<void> {
  const report = await screen.findByTestId(testId);
  within(report).getByText(title);
  if (subtitle) {
    within(report).getByText(subtitle);
  }
  expect(within(report).getByTestId('total-ballot-count')).toHaveTextContent(
    `${ballotCount}`
  );
  if (contestCount) {
    expect(within(report).getAllByTestId(/results-table/)).toHaveLength(
      contestCount
    );
  }
}

function expectReportSections(num: number): void {
  expect(screen.getAllByTestId(/tally-report/)).toHaveLength(num);
}

test('full election tally report screen, general', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: {},
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );

  renderInAppContext(<FullElectionTallyReportScreen />, {
    electionDefinition,
    logger,
    apiMock,
    route: routerPaths.tallyFullReport,
  });

  await checkReportSection({
    testId: 'tally-report',
    title: 'Unofficial Lincoln Municipal General Election Tally Report',
    ballotCount: 10,
    contestCount: election.contests.length,
  });
  expectReportSections(1);
});

test('full election tally report screen, primary', async () => {
  const { election } = electionTwoPartyPrimaryDefinition;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: {},
    },
    [
      getSimpleMockTallyResults({
        election,
        scannedBallotCount: 25,
        cardCountsByParty: {
          '0': 10,
          '1': 15,
        },
      }),
    ]
  );

  renderInAppContext(<FullElectionTallyReportScreen />, {
    electionDefinition: electionTwoPartyPrimaryDefinition,
    logger,
    apiMock,
    route: routerPaths.tallyFullReport,
  });

  await checkReportSection({
    testId: 'tally-report-0',
    title: 'Unofficial Mammal Party Example Primary Election Tally Report',
    ballotCount: 10,
    contestCount: 2,
  });
  await checkReportSection({
    testId: 'tally-report-1',
    title: 'Unofficial Fish Party Example Primary Election Tally Report',
    ballotCount: 15,
    contestCount: 2,
  });
  await checkReportSection({
    testId: 'tally-report-nonpartisan',
    title:
      'Unofficial Example Primary Election Nonpartisan Contests Tally Report',
    ballotCount: 25,
    contestCount: 3,
  });
  expectReportSections(3);
});

test('precinct tally report screen', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: { precinctIds: ['23'] },
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );

  renderInAppContext(
    <Route
      path={routerPaths.tallyPrecinctReport({ precinctId: ':precinctId' })}
    >
      <PrecinctTallyReportScreen />
    </Route>,
    {
      electionDefinition,
      logger,
      apiMock,
      route: routerPaths.tallyPrecinctReport({ precinctId: '23' }),
    }
  );

  await checkReportSection({
    testId: 'tally-report',
    title: 'Unofficial Precinct Tally Report for North Lincoln',
    subtitle: 'Lincoln Municipal General Election',
    ballotCount: 10,
  });
  expectReportSections(1);
});

test('scanner tally report screen', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: { scannerIds: ['scanner-1'] },
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );

  renderInAppContext(
    <Route path={routerPaths.tallyScannerReport({ scannerId: ':scannerId' })}>
      <ScannerTallyReportScreen />
    </Route>,
    {
      electionDefinition,
      logger,
      apiMock,
      route: routerPaths.tallyScannerReport({ scannerId: 'scanner-1' }),
    }
  );

  await checkReportSection({
    testId: 'tally-report',
    title: 'Unofficial Scanner Tally Report for Scanner scanner-1',
    subtitle: 'Lincoln Municipal General Election',
    ballotCount: 10,
  });
  expectReportSections(1);
});

test('batch tally report screen', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: { batchIds: ['batch-1'] },
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );
  apiMock.expectGetScannerBatches([
    {
      batchId: 'batch-1',
      label: 'Batch 1',
      scannerId: 'scanner-1',
      electionId: 'id',
    },
  ]);

  renderInAppContext(
    <Route path={routerPaths.tallyBatchReport({ batchId: ':batchId' })}>
      <BatchTallyReportScreen />
    </Route>,
    {
      electionDefinition,
      logger,
      apiMock,
      route: routerPaths.tallyBatchReport({ batchId: 'batch-1' }),
    }
  );

  await checkReportSection({
    testId: 'tally-report',
    title: 'Unofficial Batch Tally Report for Batch 1',
    subtitle: 'Lincoln Municipal General Election',
    ballotCount: 10,
  });
  expectReportSections(1);
});

test('voting method tally report screen', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: { votingMethods: ['absentee'] },
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );

  renderInAppContext(
    <Route
      path={routerPaths.tallyVotingMethodReport({
        votingMethod: ':votingMethod',
      })}
    >
      <VotingMethodTallyReportScreen />
    </Route>,
    {
      electionDefinition,
      logger,
      apiMock,
      route: routerPaths.tallyVotingMethodReport({ votingMethod: 'absentee' }),
    }
  );

  await checkReportSection({
    testId: 'tally-report',
    title: 'Unofficial Absentee Ballot Tally Report',
    subtitle: 'Lincoln Municipal General Election',
    ballotCount: 10,
  });
  expectReportSections(1);
});

test('party tally report screen', async () => {
  const { election } = electionTwoPartyPrimaryDefinition;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: { partyIds: ['0'] },
    },
    [
      getSimpleMockTallyResults({
        election,
        scannedBallotCount: 10,
        cardCountsByParty: {
          '0': 10,
        },
        contestIds: election.contests
          .filter((c) => c.type === 'yesno' || c.partyId === '0')
          .map((c) => c.id),
      }),
    ]
  );

  renderInAppContext(
    <Route
      path={routerPaths.tallyPartyReport({
        partyId: ':partyId' as PartyId,
      })}
    >
      <PartyTallyReportScreen />
    </Route>,
    {
      electionDefinition: electionTwoPartyPrimaryDefinition,
      logger,
      apiMock,
      route: routerPaths.tallyPartyReport({ partyId: '0' as PartyId }),
    }
  );

  const mammalReport = await screen.findByTestId('tally-report-0');
  within(mammalReport).getByText('Unofficial Mammal Party Tally Report');
  within(mammalReport).getByText('Mammal Party Example Primary Election');
  expect(
    within(mammalReport).getByTestId('total-ballot-count')
  ).toHaveTextContent('10');

  await checkReportSection({
    testId: 'tally-report-0',
    title: 'Unofficial Mammal Party Tally Report',
    subtitle: 'Mammal Party Example Primary Election',
    ballotCount: 10,
  });
  await checkReportSection({
    testId: 'tally-report-nonpartisan',
    title: 'Unofficial Mammal Party Tally Report',
    subtitle: 'Example Primary Election Nonpartisan Contests',
    ballotCount: 10,
  });

  expectReportSections(2);
});

test('all precincts tally report screen', async () => {
  const { election } = electionTwoPartyPrimaryDefinition;

  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      groupBy: { groupByPrecinct: true },
    },
    [
      {
        precinctId: 'precinct-1',
        ...getSimpleMockTallyResults({
          election,
          scannedBallotCount: 30,
          cardCountsByParty: {
            '0': 10,
            '1': 20,
          },
        }),
      },
      {
        precinctId: 'precinct-2',
        ...getSimpleMockTallyResults({
          election,
          scannedBallotCount: 25,
          cardCountsByParty: {
            '0': 20,
            '1': 5,
          },
        }),
      },
    ]
  );

  renderInAppContext(<AllPrecinctsTallyReportScreen />, {
    electionDefinition: electionTwoPartyPrimaryDefinition,
    logger,
    apiMock,
    route: routerPaths.tallyAllPrecinctsReport,
  });

  await screen.findByText('Unofficial All Precincts Tally Report');

  await checkReportSection({
    testId: 'tally-report-precinct-1-0',
    title: 'Unofficial Precinct Tally Report for Precinct 1',
    subtitle: 'Mammal Party Example Primary Election',
    ballotCount: 10,
  });
  await checkReportSection({
    testId: 'tally-report-precinct-1-1',
    title: 'Unofficial Precinct Tally Report for Precinct 1',
    subtitle: 'Fish Party Example Primary Election',
    ballotCount: 20,
  });
  await checkReportSection({
    testId: 'tally-report-precinct-1-nonpartisan',
    title: 'Unofficial Precinct Tally Report for Precinct 1',
    subtitle: 'Example Primary Election Nonpartisan Contests',
    ballotCount: 30,
  });
  await checkReportSection({
    testId: 'tally-report-precinct-2-0',
    title: 'Unofficial Precinct Tally Report for Precinct 2',
    subtitle: 'Mammal Party Example Primary Election',
    ballotCount: 20,
  });
  await checkReportSection({
    testId: 'tally-report-precinct-2-1',
    title: 'Unofficial Precinct Tally Report for Precinct 2',
    subtitle: 'Fish Party Example Primary Election',
    ballotCount: 5,
  });
  await checkReportSection({
    testId: 'tally-report-precinct-2-nonpartisan',
    title: 'Unofficial Precinct Tally Report for Precinct 2',
    subtitle: 'Example Primary Election Nonpartisan Contests',
    ballotCount: 25,
  });

  expectReportSections(6);
});

test('mark official results button disabled when no cvr files', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;
  apiMock.expectGetCastVoteRecordFileMode('unlocked');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: {},
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );

  renderInAppContext(<FullElectionTallyReportScreen />, {
    electionDefinition,
    logger,
    apiMock,
    route: routerPaths.tallyFullReport,
  });

  await screen.findByTestId('tally-report');
  expect(
    screen.getByRole('button', {
      name: 'Mark Tally Results as Official',
    })
  ).toBeDisabled();
});

test('mark official results button disabled when already official', async () => {
  const { election, electionDefinition } = electionFamousNames2021Fixtures;
  apiMock.expectGetCastVoteRecordFileMode('official');
  apiMock.expectGetResultsForTallyReports(
    {
      filter: {},
    },
    [getSimpleMockTallyResults({ election, scannedBallotCount: 10 })]
  );

  renderInAppContext(<FullElectionTallyReportScreen />, {
    electionDefinition,
    logger,
    apiMock,
    route: routerPaths.tallyFullReport,
    isOfficialResults: true,
  });

  await screen.findByTestId('tally-report');
  expect(
    screen.getByRole('button', {
      name: 'Mark Tally Results as Official',
    })
  ).toBeDisabled();
});

// marking results as official is tested in higher-level tests to confirm refetching
