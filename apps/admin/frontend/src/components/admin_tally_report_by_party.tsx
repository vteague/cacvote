import { ElectionDefinition, Tabulation } from '@votingworks/types';
import React from 'react';

import { find, unique } from '@votingworks/basics';
import type { TallyReportResults } from '@votingworks/admin-backend';
import { AdminTallyReport } from '@votingworks/ui';
import { getContestById, getEmptyCardCounts } from '@votingworks/utils';

/**
 * The `AdminTallyReport` in `libs/ui` displays only a single set of election results,
 * but for primary elections all of our printed reports are separated by party. This
 * component displays the results by party, if applicable. It also adds a nonpartisan
 * contest page if there are nonpartisan contests in a primary election.
 *
 * `tallyReportResults` - results provided by the backend
 * `contests` - list of contests applicable to the reports (based on report filters)
 * `title` - if not indicated, report is assumed to be the "Full Election Tally"
 * `restrictToPartyIds` - if indicated, only these parties will be included in the report
 */
export function AdminTallyReportByParty({
  electionDefinition,
  tallyReportResults,
  title,
  isTest,
  isOfficial,
  isForLogicAndAccuracyTesting,
  testId,
  generatedAtTime,
  customFilter,
}: {
  electionDefinition: ElectionDefinition;
  tallyReportResults: TallyReportResults;
  title?: string;
  isTest: boolean;
  isOfficial: boolean;
  isForLogicAndAccuracyTesting?: boolean;
  testId: string;
  generatedAtTime: Date;
  customFilter?: Tabulation.Filter;
}): JSX.Element {
  const { election } = electionDefinition;
  const contests = tallyReportResults.contestIds.map((contestId) =>
    getContestById(electionDefinition, contestId)
  );

  // general election case - just return a single report section
  if (!tallyReportResults.hasPartySplits) {
    return (
      <AdminTallyReport
        testId={testId}
        electionDefinition={electionDefinition}
        contests={contests}
        scannedElectionResults={tallyReportResults.scannedResults}
        manualElectionResults={tallyReportResults?.manualResults}
        title={title ?? `${election.title} Tally Report`}
        isTest={isTest}
        isOfficial={isOfficial}
        isForLogicAndAccuracyTesting={isForLogicAndAccuracyTesting}
        subtitle={title ? election.title : undefined}
        generatedAtTime={generatedAtTime}
        customFilter={customFilter}
      />
    );
  }

  // primary election - return a report section for each relevant party
  const relevantPartyIds = unique(
    contests.map((c) => (c.type === 'candidate' ? c.partyId : undefined))
  );

  const partyCompleteTallyReports: JSX.Element[] = [];

  for (const partyId of relevantPartyIds) {
    if (!partyId) continue; // non-partisan contests handled separately

    const partyCardCounts =
      tallyReportResults.cardCountsByParty[partyId] ?? getEmptyCardCounts();

    const party = find(election.parties, (p) => p.id === partyId);
    const partyElectionTitle = `${party.fullName} ${election.title}`;

    partyCompleteTallyReports.push(
      <AdminTallyReport
        key={`${testId}-${partyId}`}
        testId={`${testId}-${partyId}`}
        electionDefinition={electionDefinition}
        contests={contests.filter(
          (c) => c.type === 'candidate' && c.partyId === partyId
        )}
        scannedElectionResults={tallyReportResults.scannedResults}
        manualElectionResults={
          partyCardCounts.manual ? tallyReportResults.manualResults : undefined
        }
        title={title ?? `${partyElectionTitle} Tally Report`}
        isTest={isTest}
        isOfficial={isOfficial}
        isForLogicAndAccuracyTesting={isForLogicAndAccuracyTesting}
        subtitle={title ? partyElectionTitle : undefined}
        cardCountsOverride={partyCardCounts}
        customFilter={customFilter}
      />
    );
  }

  // if there are nonpartisan contests, we must add a nonpartisan page
  // and combine the results across partisan ballots
  if (relevantPartyIds.includes(undefined)) {
    const nonpartisanElectionTitle = `${election.title} Nonpartisan Contests`;

    partyCompleteTallyReports.push(
      <AdminTallyReport
        key={`${testId}-nonpartisan`}
        testId={`${testId}-nonpartisan`}
        electionDefinition={electionDefinition}
        contests={contests.filter((c) => c.type === 'yesno' || !c.partyId)}
        scannedElectionResults={tallyReportResults.scannedResults}
        manualElectionResults={tallyReportResults.manualResults}
        title={title ?? `${nonpartisanElectionTitle} Tally Report`}
        isTest={isTest}
        isOfficial={isOfficial}
        isForLogicAndAccuracyTesting={isForLogicAndAccuracyTesting}
        subtitle={title ? nonpartisanElectionTitle : undefined}
        customFilter={customFilter}
      />
    );
  }

  return <React.Fragment>{partyCompleteTallyReports}</React.Fragment>;
}
