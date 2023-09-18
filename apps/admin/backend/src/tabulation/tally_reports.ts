import { Id, Tabulation } from '@votingworks/types';
import { assert, assertDefined, mapObject } from '@votingworks/basics';
import {
  coalesceGroupsAcrossParty,
  combineElectionResults,
  combineGroupSpecifierAndFilter,
  combineManualElectionResults,
  groupMapToGroupList,
  mergeTabulationGroupMaps,
  mergeWriteInTallies,
} from '@votingworks/utils';
import { Store } from '../store';
import {
  CardCountsByParty,
  PartySplitTallyReportResults,
  SingleTallyReportResults,
  TallyReportResults,
} from '../types';
import { tabulateElectionResults } from './full_results';
import { tabulateManualResults } from './manual_results';
import { rootDebug } from '../util/debug';

const debug = rootDebug.extend('tabulation');

function addContestIdsToReports<U>({
  reports,
  overallFilter,
  store,
  electionId,
}: {
  reports: Tabulation.GroupList<U>;
  overallFilter: Tabulation.Filter;
  store: Store;
  electionId: Id;
}): Tabulation.GroupList<U & { contestIds: Id[] }> {
  return reports.map((report) => {
    const contestIds = store.getFilteredContests({
      electionId,
      filter: combineGroupSpecifierAndFilter(report, overallFilter),
    });
    return {
      ...report,
      contestIds,
    };
  });
}

/**
 * Tabulates grouped tally reports for an election. This includes scanned results
 * adjusted with write-in adjudication data (but combining all unofficial write-ins)
 * and manual results separately.
 */
export async function tabulateTallyReportResults({
  electionId,
  store,
  filter = {},
  groupBy = {},
}: {
  electionId: Id;
  store: Store;
  filter?: Tabulation.Filter;
  groupBy?: Tabulation.GroupBy;
}): Promise<Tabulation.GroupList<TallyReportResults>> {
  const {
    electionDefinition: { election },
  } = assertDefined(store.getElection(electionId));

  // For frontend tally reports, we always tabulate by party in primaries
  // so that we can get card counts by party.
  const primarySensitiveGroupBy: Tabulation.GroupBy =
    election.type === 'primary'
      ? {
          ...groupBy,
          groupByParty: true,
        }
      : groupBy;

  debug('tabulating scanned election results for tally report');
  const allScannedResults = mapObject(
    await tabulateElectionResults({
      electionId,
      store,
      filter,
      groupBy: primarySensitiveGroupBy,
      includeWriteInAdjudicationResults: true,
      includeManualResults: false,
    }),
    // We need to incorporate adjudication results to adjust official candidate and
    // undervote counts, but we want the unofficial candidates bucketed, so we
    // merge after the fact.
    mergeWriteInTallies
  );

  debug('tabulating manual election results for tally report');
  let allManualResults: Tabulation.ManualResultsGroupMap = {};
  const manualTabulationResult = tabulateManualResults({
    electionId,
    store,
    filter,
    groupBy: primarySensitiveGroupBy,
  });
  if (manualTabulationResult.isErr()) {
    debug('filter or group by is not compatible with manual results');
  } else {
    allManualResults = mapObject(
      manualTabulationResult.ok(),
      mergeWriteInTallies
    );
  }

  debug('organizing scanned and manual results together');
  const allSingleTallyReportResultsWithoutContestIds: Tabulation.GroupList<
    Omit<SingleTallyReportResults, 'contestIds'>
  > = groupMapToGroupList(
    mergeTabulationGroupMaps(
      allScannedResults,
      allManualResults,
      (scannedResults, manualResults) => {
        assert(scannedResults);
        return {
          scannedResults,
          manualResults,
          hasPartySplits: false,
          cardCounts: {
            ...scannedResults.cardCounts,
            manual: manualResults?.ballotCount,
          },
        };
      }
    )
  );

  if (election.type === 'general') {
    debug('calculating relevant contests for each report');
    return addContestIdsToReports({
      reports: allSingleTallyReportResultsWithoutContestIds,
      overallFilter: filter,
      store,
      electionId,
    });
  }

  assert(election.type === 'primary');
  debug('grouping results across party for primary election reports');
  const allPartySplitReportResultsWithoutContestIds: Tabulation.GroupList<
    Omit<PartySplitTallyReportResults, 'contestIds'>
  > = coalesceGroupsAcrossParty(
    allSingleTallyReportResultsWithoutContestIds,
    groupBy,
    (reportsByParty) => {
      // combine scanned results
      const combinedScannedResults = combineElectionResults({
        election,
        allElectionResults: reportsByParty.map(
          (byPartyReport) => byPartyReport.scannedResults
        ),
      });

      // combine manual results
      const nonEmptyManualResults = reportsByParty
        .map((byPartyReport) => byPartyReport.manualResults)
        .filter(
          (manualResults): manualResults is Tabulation.ManualElectionResults =>
            !!manualResults
        );
      const combinedManualResults = nonEmptyManualResults.length
        ? combineManualElectionResults({
            election,
            allManualResults: nonEmptyManualResults,
          })
        : undefined;

      // maintain split for card counts
      const cardCountsByParty: CardCountsByParty = reportsByParty.reduce(
        (ccByParty, partyTallyReportResults) => {
          assert(partyTallyReportResults.partyId !== undefined);
          return {
            ...ccByParty,
            [partyTallyReportResults.partyId]:
              partyTallyReportResults.cardCounts,
          };
        },
        {}
      );
      return {
        hasPartySplits: true,
        scannedResults: combinedScannedResults,
        manualResults: combinedManualResults,
        cardCountsByParty,
      };
    }
  );

  debug('calculating relevant contests for each report');
  return addContestIdsToReports({
    reports: allPartySplitReportResultsWithoutContestIds,
    overallFilter: filter,
    store,
    electionId,
  });
}