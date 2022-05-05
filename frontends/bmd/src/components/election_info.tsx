import { DateTime } from 'luxon';
import React from 'react';
import styled from 'styled-components';

import {
  BallotStyleId,
  ElectionDefinition,
  getPartyPrimaryAdjectiveFromBallotStyle,
} from '@votingworks/types';
import { formatLongDate } from '@votingworks/utils';

import { Prose } from '@votingworks/ui';
import { Seal } from './seal';
import { Text, NoWrap } from './text';
import { PrecinctSelection } from '../config/types';
import { precinctSelectionName } from '../utils/precinct_selection';

const VerticalContainer = styled.div`
  display: block;
  margin: auto;
  div:first-child {
    margin: 0 auto 0.5rem;
  }
`;

const CenterinBlock = styled.div`
  display: flex;
  margin: 1.5rem 1rem 0;
`;

const HorizontalContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: auto;
  div:first-child {
    margin-right: 1rem;
    min-width: 5rem;
  }
`;

interface Props {
  precinctSelection?: PrecinctSelection;
  ballotStyleId?: BallotStyleId;
  electionDefinition: ElectionDefinition;
  horizontal?: boolean;
}

export function ElectionInfo({
  precinctSelection,
  ballotStyleId,
  electionDefinition,
  horizontal = false,
}: Props): JSX.Element {
  const { election } = electionDefinition;
  const { title: t, state, county, date, seal, sealURL: sealUrl } = election;
  const precinctName =
    precinctSelection &&
    precinctSelectionName(election.precincts, precinctSelection);
  const partyPrimaryAdjective = ballotStyleId
    ? getPartyPrimaryAdjectiveFromBallotStyle({
        election,
        ballotStyleId,
      })
    : '';
  const title = `${partyPrimaryAdjective} ${t}`;
  if (horizontal) {
    return (
      <CenterinBlock aria-hidden data-testid="election-info">
        <HorizontalContainer>
          <Seal seal={seal} sealUrl={sealUrl} />
          <Prose compact>
            <h5 aria-label={`${title}.`}>{title}</h5>
            <Text small>
              {formatLongDate(DateTime.fromISO(date))}
              <br />
              <NoWrap>{county.name},</NoWrap> <NoWrap>{state}</NoWrap>
            </Text>
            <Text small light>
              {precinctName && (
                <NoWrap>
                  {precinctName}
                  {ballotStyleId && ', '}
                </NoWrap>
              )}{' '}
              {ballotStyleId && <NoWrap>ballot style {ballotStyleId}</NoWrap>}
            </Text>
          </Prose>
        </HorizontalContainer>
      </CenterinBlock>
    );
  }
  return (
    <VerticalContainer aria-hidden>
      <Seal seal={seal} sealUrl={sealUrl} />
      <Prose textCenter>
        <h1 aria-label={`${title}.`}>{title}</h1>
        <p>
          {formatLongDate(DateTime.fromISO(date))}
          <br />
          {county.name}
          <br />
          {state}
        </p>
        {precinctName && <Text bold>{precinctName}</Text>}
      </Prose>
    </VerticalContainer>
  );
}
