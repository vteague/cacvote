import { Main, Screen } from '@votingworks/ui';
import styled from 'styled-components';

interface TaskScreenProps {
  children: React.ReactNode;
}

export const MainWrapper = styled(Main)`
  display: flex;
  flex-direction: row-reverse;
  overflow: hidden;
  height: 100%;
`;

export const TaskContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;

export const TaskControls = styled.div`
  display: flex;
  flex-direction: column;
`;

export const TaskHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: ${(p) => p.theme.colors.inverseBackground};
  color: ${(p) => p.theme.colors.onInverse};

  h1 {
    margin: 0;
  }

  button {
    padding: 0.5rem;
  }
`;

export function TaskScreen({ children }: TaskScreenProps): JSX.Element {
  return (
    <Screen>
      <MainWrapper>{children}</MainWrapper>
    </Screen>
  );
}
