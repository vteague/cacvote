import styled from 'styled-components';

import { AnyContest } from '@votingworks/types';
import {
  Caption,
  Font,
  Icons,
  List,
  ListItem,
  electionStrings,
} from '@votingworks/ui';
import React from 'react';

export interface ContestListProps {
  contests: readonly AnyContest[];
  helpNote: React.ReactNode;
  maxColumns: number;
  title: React.ReactNode;
}

const Container = styled.div`
  border: ${(p) => p.theme.sizes.bordersRem.hairline}rem solid
    ${(p) => p.theme.colors.foreground};
  border-radius: 0.1rem;
  padding: 0.25rem 0.5rem 0.5rem;
`;

const HelpNote = styled(Caption)`
  display: flex;
  gap: 0.25rem;
  line-height: 1;
  margin: 0.25rem 0 0.5rem;
`;

export function ContestList(props: ContestListProps): JSX.Element {
  const { contests, helpNote, maxColumns, title } = props;

  return (
    <Container>
      <Font weight="bold">{title}</Font>
      <HelpNote weight="semiBold">
        <Icons.Info />
        <span>{helpNote}</span>
      </HelpNote>
      <List maxColumns={maxColumns}>
        {contests.map((c) => (
          <Caption key={c.id}>
            <ListItem>{electionStrings.contestTitle(c)}</ListItem>
          </Caption>
        ))}
      </List>
    </Container>
  );
}
