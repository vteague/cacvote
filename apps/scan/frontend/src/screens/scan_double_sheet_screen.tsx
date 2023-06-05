import React from 'react';
import { Caption, FullScreenIconWrapper, Icons, P } from '@votingworks/ui';
import { Screen } from '../components/layout';
import { FullScreenPromptLayout } from '../components/full_screen_prompt_layout';

interface Props {
  scannedBallotCount: number;
}

export function ScanDoubleSheetScreen({
  scannedBallotCount,
}: Props): JSX.Element {
  return (
    <Screen centerContent ballotCountOverride={scannedBallotCount}>
      <FullScreenPromptLayout
        title="Ballot Not Counted"
        image={
          <FullScreenIconWrapper color="danger">
            <Icons.DangerX />
          </FullScreenIconWrapper>
        }
      >
        <P>Multiple sheets detected.</P>
        <Caption>Remove your ballot and insert one sheet at a time.</Caption>
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanDoubleSheetScreen scannedBallotCount={42} />;
}
