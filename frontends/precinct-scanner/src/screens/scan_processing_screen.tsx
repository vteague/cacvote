import React from 'react';
import { IndeterminateProgressBar } from '../components/graphics';
import { CenteredLargeProse, CenteredScreen } from '../components/layout';

export function ScanProcessingScreen(): JSX.Element {
  return (
    <CenteredScreen>
      <IndeterminateProgressBar />
      <CenteredLargeProse>
        <h1>Scanning Ballot…</h1>
      </CenteredLargeProse>
    </CenteredScreen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanProcessingScreen />;
}