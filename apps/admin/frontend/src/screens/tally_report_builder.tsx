import { Font, H3, Icons, LinkButton, P } from '@votingworks/ui';
import { useContext, useState } from 'react';
import { assert } from '@votingworks/basics';
import {
  isElectionManagerAuth,
  isFilterEmpty,
  isGroupByEmpty,
} from '@votingworks/utils';
import { Tabulation } from '@votingworks/types';
import styled from 'styled-components';
import { AppContext } from '../contexts/app_context';
import { NavigationScreen } from '../components/navigation_screen';
import { routerPaths } from '../router_paths';
import { FilterEditor } from '../components/reporting/filter_editor';
import { GroupByEditor } from '../components/reporting/group_by_editor';
import { TallyReportViewer } from '../components/reporting/tally_report_viewer';
import { canonicalizeFilter, canonicalizeGroupBy } from '../utils/reporting';

const SCREEN_TITLE = 'Tally Report Builder';

const FilterEditorContainer = styled.div`
  width: 80%;
  margin-bottom: 2rem;
`;

const GroupByEditorContainer = styled.div`
  width: 80%;
  margin-top: 0.5rem;
  margin-bottom: 2rem;
`;

export function TallyReportBuilder(): JSX.Element {
  const { electionDefinition, auth } = useContext(AppContext);
  assert(electionDefinition);
  assert(isElectionManagerAuth(auth)); // TODO(auth) check permissions for viewing tally reports.
  const { election } = electionDefinition;

  const [filter, setFilter] = useState<Tabulation.Filter>({});
  const [groupBy, setGroupBy] = useState<Tabulation.GroupBy>({});

  function updateFilter(newFilter: Tabulation.Filter) {
    setFilter(canonicalizeFilter(newFilter));
  }

  function updateGroupBy(newGroupBy: Tabulation.GroupBy) {
    setGroupBy(canonicalizeGroupBy(newGroupBy));
  }

  const hasMadeSelections = !isFilterEmpty(filter) || !isGroupByEmpty(groupBy);
  return (
    <NavigationScreen title={SCREEN_TITLE}>
      <P>
        <LinkButton small to={routerPaths.reports}>
          <Icons.Previous /> Back
        </LinkButton>
      </P>
      <P>
        Use the report builder to create custom reports for print or export.
      </P>
      <ul>
        <li>
          <Font weight="bold">Filters</Font> restrict the report to ballots
          matching the criteria
        </li>
        <li>
          <Font weight="bold">Report By</Font> organizes the results into
          multiple reports
        </li>
      </ul>
      <H3>Filters</H3>
      <FilterEditorContainer>
        <FilterEditor election={election} onChange={updateFilter} />
      </FilterEditorContainer>
      <H3>Report By</H3>
      <GroupByEditorContainer>
        <GroupByEditor groupBy={groupBy} setGroupBy={updateGroupBy} />
      </GroupByEditorContainer>
      <TallyReportViewer
        filter={filter}
        groupBy={groupBy}
        disabled={!hasMadeSelections}
        autoPreview={false}
      />
    </NavigationScreen>
  );
}