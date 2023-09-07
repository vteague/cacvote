import { ElectionDefinition, Tabulation } from '@votingworks/types';
import {
  Button,
  Caption,
  Font,
  H6,
  Icons,
  Loading,
  Modal,
  printElement,
  printElementToPdf,
} from '@votingworks/ui';
import React, { useContext, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Optional, assert, assertDefined } from '@votingworks/basics';
import {
  combineGroupSpecifierAndFilter,
  isElectionManagerAuth,
} from '@votingworks/utils';
import type { TallyReportResults } from '@votingworks/admin-backend';
import { LogEventId } from '@votingworks/logging';
import {
  getCastVoteRecordFileMode,
  getResultsForTallyReports,
} from '../../api';
import { AppContext } from '../../contexts/app_context';
import { AdminTallyReportByParty } from '../admin_tally_report_by_party';
import { PrintButton } from '../print_button';
import {
  generateTallyReportPdfFilename,
  generateTitleForReport,
} from '../../utils/reporting';
import { ExportReportPdfButton } from './export_report_pdf_button';
import { ExportCsvResultsButton } from './export_csv_button';

const ExportActions = styled.div`
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: start;
  gap: 1rem;
`;

const PreviewContainer = styled.div`
  position: relative;
  min-height: 11in;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 10%);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const PreviewOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  background: black;
  opacity: 0.3;
`;

const PreviewReportPages = styled.div`
  section {
    background: white;
    position: relative;
    box-shadow: 0 3px 10px rgb(0, 0, 0, 20%);
    margin-top: 1rem;
    margin-bottom: 2rem;
    width: 8.5in;
    min-height: 11in;
    padding: 0.5in;
  }
`;

const PreviewActionContainer = styled.div`
  position: absolute;
  inset: 0;
  margin-left: auto;
  margin-right: auto;
  margin-top: 4rem;
  display: flex;
  justify-content: center;
  align-items: start;
  z-index: 2;
`;

const LoadingTextContainer = styled.div`
  background: white;
  width: 35rem;
  border-radius: 0.5rem;
`;

function Reports({
  electionDefinition,
  isOfficialResults,
  allTallyReportResults,
  filterUsed,
  generatedAtTime,
}: {
  electionDefinition: ElectionDefinition;
  isOfficialResults: boolean;
  allTallyReportResults: Tabulation.GroupList<TallyReportResults>;
  filterUsed: Tabulation.Filter;
  generatedAtTime: Date;
}): JSX.Element {
  const allReports: JSX.Element[] = [];

  for (const [index, tallyReportResults] of allTallyReportResults.entries()) {
    const sectionFilter = combineGroupSpecifierAndFilter(
      tallyReportResults,
      filterUsed
    );
    const titleGeneration = generateTitleForReport({
      filter: sectionFilter,
      electionDefinition,
    });
    const title = titleGeneration.isOk()
      ? titleGeneration.ok()
      : 'Custom Filter Tally Report';
    const displayedFilter = !titleGeneration.isOk() ? sectionFilter : undefined;

    allReports.push(
      <AdminTallyReportByParty
        electionDefinition={electionDefinition}
        testId="tally-report"
        key={`tally-report-${index}`}
        title={title}
        tallyReportResults={tallyReportResults}
        tallyReportType={isOfficialResults ? 'Official' : 'Unofficial'}
        generatedAtTime={generatedAtTime}
        customFilter={displayedFilter}
      />
    );
  }

  return <React.Fragment>{allReports}</React.Fragment>;
}

export interface TallyReportViewerProps {
  filter: Tabulation.Filter;
  groupBy: Tabulation.GroupBy;
  disabled: boolean;
  autoPreview: boolean;
}

export function TallyReportViewer({
  filter,
  groupBy,
  disabled,
  autoPreview,
}: TallyReportViewerProps): JSX.Element {
  const { electionDefinition, isOfficialResults, auth, logger } =
    useContext(AppContext);
  assert(electionDefinition);
  const { election } = electionDefinition;
  assert(isElectionManagerAuth(auth));
  const userRole = auth.user.role;

  const [isFetchingForPreview, setIsFetchingForPreview] = useState(false);
  const [progressModalText, setProgressModalText] = useState<string>();

  const castVoteRecordFileModeQuery = getCastVoteRecordFileMode.useQuery();
  const reportResultsQuery = getResultsForTallyReports.useQuery(
    {
      filter,
      groupBy,
    },
    { enabled: !disabled && autoPreview }
  );
  const reportResultsAreFresh =
    reportResultsQuery.isSuccess && !reportResultsQuery.isStale;

  const previewReportRef = useRef<Optional<JSX.Element>>();
  const previewReport: Optional<JSX.Element> = useMemo(() => {
    // Avoid populating the preview with cached data before the caller signals that the parameters are viable
    if (disabled) {
      return undefined;
    }

    // If there's not current fresh data, return the previous preview report
    if (!reportResultsAreFresh) {
      return previewReportRef.current;
    }

    return (
      <Reports
        electionDefinition={assertDefined(electionDefinition)}
        filterUsed={filter}
        allTallyReportResults={reportResultsQuery.data}
        generatedAtTime={new Date(reportResultsQuery.dataUpdatedAt)}
        isOfficialResults={isOfficialResults}
      />
    );
  }, [
    disabled,
    reportResultsAreFresh,
    electionDefinition,
    filter,
    reportResultsQuery.data,
    reportResultsQuery.dataUpdatedAt,
    isOfficialResults,
  ]);
  previewReportRef.current = previewReport;
  const previewIsFresh =
    reportResultsQuery.isSuccess && !reportResultsQuery.isStale;

  async function refreshPreview() {
    setIsFetchingForPreview(true);
    await reportResultsQuery.refetch();
    setIsFetchingForPreview(false);
  }

  async function getFreshQueryResult(): Promise<typeof reportResultsQuery> {
    if (reportResultsAreFresh) {
      return reportResultsQuery;
    }

    return reportResultsQuery.refetch({ cancelRefetch: false });
  }

  async function printReport() {
    setProgressModalText('Generating Report');
    const queryResults = await getFreshQueryResult();
    assert(queryResults.isSuccess);
    const reportToPrint = (
      <Reports
        electionDefinition={assertDefined(electionDefinition)}
        filterUsed={filter}
        allTallyReportResults={queryResults.data}
        generatedAtTime={new Date(queryResults.dataUpdatedAt)}
        isOfficialResults={isOfficialResults}
      />
    );

    setProgressModalText('Printing Report');
    try {
      await printElement(reportToPrint, { sides: 'one-sided' });
      await logger.log(LogEventId.TallyReportPrinted, userRole, {
        message: `User printed a custom tally report from the report builder.`,
        disposition: 'success',
      });
    } catch (error) {
      assert(error instanceof Error);
      await logger.log(LogEventId.TallyReportPrinted, userRole, {
        message: `User attempted to print a custom tally report from the report builder, but an error occurred: ${error.message}`,
        disposition: 'failure',
      });
    } finally {
      setProgressModalText(undefined);
    }
  }

  async function generateReportPdf(): Promise<Uint8Array> {
    const queryResults = await getFreshQueryResult();
    assert(queryResults.isSuccess);
    const reportToSave = (
      <Reports
        electionDefinition={assertDefined(electionDefinition)}
        filterUsed={filter}
        allTallyReportResults={queryResults.data}
        generatedAtTime={new Date(queryResults.dataUpdatedAt)}
        isOfficialResults={isOfficialResults}
      />
    );

    return printElementToPdf(reportToSave);
  }

  const reportPdfFilename = generateTallyReportPdfFilename({
    election,
    filter,
    groupBy,
    isTestMode: castVoteRecordFileModeQuery.data === 'test',
    time: reportResultsQuery.dataUpdatedAt
      ? new Date(reportResultsQuery.dataUpdatedAt)
      : undefined,
  });

  return (
    <React.Fragment>
      <ExportActions>
        <PrintButton
          print={printReport}
          variant="primary"
          disabled={disabled}
          useDefaultProgressModal={false}
        >
          Print Report
        </PrintButton>
        <ExportReportPdfButton
          electionDefinition={electionDefinition}
          generateReportPdf={generateReportPdf}
          defaultFilename={reportPdfFilename}
          disabled={disabled}
        />
        <ExportCsvResultsButton
          filter={filter}
          groupBy={groupBy}
          disabled={disabled}
        />
      </ExportActions>

      <Caption>
        <Icons.Info /> <Font weight="bold">Note:</Font> Printed reports may be
        paginated to more than one piece of paper.
      </Caption>
      <PreviewContainer>
        {!disabled && (
          <React.Fragment>
            {previewReport && (
              <PreviewReportPages>{previewReport}</PreviewReportPages>
            )}
            {!previewIsFresh && <PreviewOverlay />}
            {isFetchingForPreview && (
              <PreviewActionContainer>
                <LoadingTextContainer>
                  <Loading>Generating Report</Loading>
                </LoadingTextContainer>
              </PreviewActionContainer>
            )}
            {!isFetchingForPreview && !previewIsFresh && (
              <PreviewActionContainer>
                {previewReport ? (
                  <Button onPress={refreshPreview}>
                    <Icons.RotateRight /> Refresh Preview
                  </Button>
                ) : (
                  <Button onPress={refreshPreview}>Load Preview</Button>
                )}
              </PreviewActionContainer>
            )}
          </React.Fragment>
        )}
      </PreviewContainer>
      {progressModalText && (
        <Modal
          centerContent
          content={
            <H6>
              <Loading>{progressModalText}</Loading>
            </H6>
          }
        />
      )}
    </React.Fragment>
  );
}
