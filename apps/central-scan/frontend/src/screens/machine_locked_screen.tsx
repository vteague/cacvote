import { ElectionInfoBar, Font, H1, H3, Main, Screen } from '@votingworks/ui';
import React, { useContext } from 'react';
import styled from 'styled-components';

import { AppContext } from '../contexts/app_context';

const LockedImage = styled.img`
  margin-right: auto;
  margin-bottom: 1.25em;
  margin-left: auto;
  height: 20vw;
`;

export function MachineLockedScreen(): JSX.Element {
  const { electionDefinition, machineConfig } = useContext(AppContext);
  return (
    <Screen>
      <Main padded centerChild>
        <div>
          <LockedImage src="/locked.svg" alt="Locked Icon" />
          <Font align="center">
            {electionDefinition ? (
              <React.Fragment>
                <H1>VxCentralScan is Locked</H1>
                <H3 style={{ fontWeight: 'normal' }}>
                  Insert Election Manager card to unlock.
                </H3>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <H1>VxCentralScan is Not Configured</H1>
                <H3 style={{ fontWeight: 'normal' }}>
                  Insert Election Manager card to configure.
                </H3>
              </React.Fragment>
            )}
          </Font>
        </div>
      </Main>
      {electionDefinition && (
        <ElectionInfoBar
          mode="admin"
          electionDefinition={electionDefinition}
          codeVersion={machineConfig.codeVersion}
          machineId={machineConfig.machineId}
        />
      )}
    </Screen>
  );
}
