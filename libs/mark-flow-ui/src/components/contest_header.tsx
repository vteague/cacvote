import React from 'react';
import styled from 'styled-components';

import { Caption, Font, H2, electionStrings } from '@votingworks/ui';
import { Contest } from '@votingworks/types';
import { MsEitherNeitherContest } from '../utils/ms_either_neither_contests';

export interface ContestHeaderProps {
  breadcrumbs?: BreadcrumbMetadata;
  children?: React.ReactNode;
  contest: Contest | MsEitherNeitherContest;
  districtName: string;
}

export interface BreadcrumbMetadata {
  ballotContestCount: number;
  contestNumber: number;
}

const Container = styled.div`
  padding: 0.25rem 0.5rem 0.5rem;
`;

const ContestInfo = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
`;

export function ContestHeader(props: ContestHeaderProps): JSX.Element {
  const { breadcrumbs, children, contest, districtName } = props;

  return (
    <Container id="contest-header">
      <div id="audiofocus">
        <ContestInfo>
          <Caption weight="semiBold">{districtName}</Caption>
          {breadcrumbs && (
            <Caption noWrap>
              Contest <Font weight="bold">{breadcrumbs.contestNumber}</Font> of{' '}
              <Font weight="bold">{breadcrumbs.ballotContestCount}</Font>
            </Caption>
          )}
        </ContestInfo>
        <div>
          <H2 as="h1">{electionStrings.contestTitle(contest)}</H2>
        </div>
        {children}
      </div>
    </Container>
  );
}
