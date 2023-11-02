import {
  assert,
  throwIllegalValue,
  typedAs,
  unique,
} from '@votingworks/basics';
import { Election, Tabulation } from '@votingworks/types';
import { useState } from 'react';
import styled from 'styled-components';
import { SearchSelect, SelectOption, Button } from '@votingworks/ui';
import type { ScannerBatch } from '@votingworks/admin-backend';
import { getScannerBatches } from '../../api';
import { getPartiesWithPrimaryElections } from '../../utils/election';

const FilterEditorContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FilterRow = styled.div`
  flex-shrink: 0;
  width: 100%;
  display: grid;
  grid-template-columns: 10rem 4rem 1fr 2rem;
  min-height: 3.25rem;
  align-items: start;
`;

// We want the selects in FilterRow to be able to expand down to multiple
// rows, but we want the other items in the row to be center aligned with the
// single-row select, so we can use `align-items: center` on FilterRow, because
// the row height changes with the selects. Instead, we use this container for
// the other items in the row and try to match it to about the height of the Select.
const ContainerWithSelectHeight = styled.div`
  height: 3.25rem;
  display: flex;
  align-items: center;
`;

const Predicate = styled(ContainerWithSelectHeight)`
  justify-self: center;
`;

const AddButton = styled(Button)`
  min-width: 6rem;
`;

const FILTER_TYPES = [
  'precinct',
  'voting-method',
  'ballot-style',
  'scanner',
  'batch',
  'party',
] as const;
export type FilterType = (typeof FILTER_TYPES)[number];

interface FilterRow {
  rowId: number;
  filterType: FilterType;
  filterValues: string[];
}
type FilterRows = FilterRow[];

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  precinct: 'Precinct',
  'voting-method': 'Voting Method',
  'ballot-style': 'Ballot Style',
  scanner: 'Scanner',
  batch: 'Batch',
  party: 'Party',
};

function getFilterTypeOption(filterType: FilterType): SelectOption<FilterType> {
  return {
    value: filterType,
    label: FILTER_TYPE_LABELS[filterType],
  };
}

function generateOptionsForFilter({
  filterType,
  election,
  scannerBatches,
}: {
  filterType: FilterType;
  election: Election;
  scannerBatches: ScannerBatch[];
}): SelectOption[] {
  switch (filterType) {
    case 'precinct':
      return election.precincts.map((precinct) => ({
        value: precinct.id,
        label: precinct.name,
      }));
    case 'ballot-style':
      return election.ballotStyles.map((bs) => ({
        value: bs.id,
        label: bs.id,
      }));
    case 'party':
      return getPartiesWithPrimaryElections(election).map((party) => ({
        value: party.id,
        label: party.name,
      }));
    case 'voting-method':
      return typedAs<Array<SelectOption<Tabulation.VotingMethod>>>([
        {
          value: 'precinct',
          label: 'Precinct',
        },
        {
          value: 'absentee',
          label: 'Absentee',
        },
      ]);
    case 'scanner':
      return unique(scannerBatches.map((sb) => sb.scannerId)).map(
        (scannerId) => ({
          value: scannerId,
          label: scannerId,
        })
      );
    case 'batch':
      return scannerBatches.map((sb) => ({
        value: sb.batchId,
        label: `${sb.scannerId} • ${sb.batchId.slice(0, 8)}`,
      }));
    /* istanbul ignore next - compile-time check for completeness */
    default:
      throwIllegalValue(filterType);
  }
}

// allow modifying filter during construction for convenience
type Writeable<T> = { -readonly [P in keyof T]: T[P] };

function convertFilterRowsToTabulationFilter(
  rows: FilterRows
): Tabulation.Filter {
  const tabulationFilter: Writeable<Tabulation.Filter> = {};
  for (const row of rows) {
    const { filterType, filterValues } = row;
    switch (filterType) {
      case 'precinct':
        tabulationFilter.precinctIds = filterValues;
        break;
      case 'voting-method':
        tabulationFilter.votingMethods =
          filterValues as Tabulation.VotingMethod[];
        break;
      case 'ballot-style':
        tabulationFilter.ballotStyleIds = filterValues;
        break;
      case 'party':
        tabulationFilter.partyIds = filterValues;
        break;
      case 'scanner':
        tabulationFilter.scannerIds = filterValues;
        break;
      case 'batch':
        tabulationFilter.batchIds = filterValues;
        break;
      /* istanbul ignore next - compile-time check for completeness */
      default:
        throwIllegalValue(filterType);
    }
  }

  return tabulationFilter;
}

export interface FilterEditorProps {
  onChange: (filter: Tabulation.Filter) => void;
  election: Election;
  allowedFilters: FilterType[];
}

export function FilterEditor({
  onChange,
  election,
  allowedFilters,
}: FilterEditorProps): JSX.Element {
  const [rows, setRows] = useState<FilterRows>([]);
  const [nextRowId, setNextRowId] = useState(0);
  const [isAddingRow, setIsAddingRow] = useState(false);

  const scannerBatchesQuery = getScannerBatches.useQuery();
  const scannerBatches = scannerBatchesQuery.data ?? [];

  function onUpdatedRows(updatedRows: FilterRows) {
    setRows(updatedRows);
    onChange(convertFilterRowsToTabulationFilter(updatedRows));
  }

  function addRow(filterType: FilterType) {
    onUpdatedRows([
      ...rows,
      {
        rowId: nextRowId,
        filterType,
        filterValues: [],
      },
    ]);
    setNextRowId((i) => i + 1);
  }

  function updateRowFilterType(rowId: number, newFilterType: FilterType): void {
    onUpdatedRows(
      rows.map((row) =>
        row.rowId === rowId
          ? { ...row, filterType: newFilterType, filterValues: [] }
          : row
      )
    );
  }

  function updateRowFilterValues(rowId: number, filterValues: string[]) {
    onUpdatedRows(
      rows.map((row) => (row.rowId === rowId ? { ...row, filterValues } : row))
    );
  }

  function deleteRow(rowId: number) {
    onUpdatedRows(rows.filter((row) => row.rowId !== rowId));
  }

  const activeFilters: FilterType[] = rows.map((row) => row.filterType);
  const unusedFilters: FilterType[] = allowedFilters.filter(
    (filterType) => !activeFilters.includes(filterType)
  );

  return (
    <FilterEditorContainer data-testid="filter-editor">
      {rows.map((row) => {
        const { filterType, rowId } = row;
        return (
          <FilterRow
            key={rowId}
            data-testid={`filter-editor-row-${filterType}`}
          >
            <SearchSelect
              isMulti={false}
              isSearchable={false}
              value={filterType}
              options={[
                getFilterTypeOption(filterType),
                ...unusedFilters.map(getFilterTypeOption),
              ]}
              onChange={(newFilterType) => {
                assert(newFilterType !== undefined);
                updateRowFilterType(rowId, newFilterType);
              }}
              ariaLabel="Edit Filter Type"
            />
            <Predicate>equals</Predicate>
            <SearchSelect
              isMulti
              isSearchable
              key={filterType}
              options={generateOptionsForFilter({
                filterType,
                election,
                scannerBatches,
              })}
              value={row.filterValues}
              onChange={(filterValues) => {
                updateRowFilterValues(rowId, filterValues);
              }}
              ariaLabel="Select Filter Values"
            />
            <ContainerWithSelectHeight>
              <Button
                icon="X"
                fill="transparent"
                onPress={() => deleteRow(rowId)}
                aria-label="Remove Filter"
              />
            </ContainerWithSelectHeight>
          </FilterRow>
        );
      })}
      {unusedFilters.length > 0 && (
        <FilterRow key="new-row">
          {isAddingRow ? (
            <SearchSelect
              key={nextRowId}
              isMulti={false}
              isSearchable={false}
              options={unusedFilters
                .filter(
                  (filterType) => !rows.some((r) => r.filterType === filterType)
                )
                .map((filterType) => getFilterTypeOption(filterType))}
              onChange={(filterType) => {
                assert(filterType !== undefined);
                addRow(filterType);
                setIsAddingRow(false);
              }}
              ariaLabel="Select New Filter Type"
            />
          ) : (
            <AddButton icon="Add" onPress={() => setIsAddingRow(true)}>
              Add Filter
            </AddButton>
          )}
          {isAddingRow && (
            <ContainerWithSelectHeight>
              <Button
                icon="X"
                fill="transparent"
                onPress={() => setIsAddingRow(false)}
                aria-label="Cancel Add Filter"
              />
            </ContainerWithSelectHeight>
          )}
        </FilterRow>
      )}
    </FilterEditorContainer>
  );
}
