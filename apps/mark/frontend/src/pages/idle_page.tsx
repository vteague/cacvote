import React, { useContext, useEffect, useState } from 'react';
import pluralize from 'pluralize';
import useInterval from 'use-interval';

import { Button, H1, Loading, Main, Prose, Screen } from '@votingworks/ui';

import {
  IDLE_RESET_TIMEOUT_SECONDS,
  IDLE_TIMEOUT_SECONDS,
} from '../config/globals';

import { BallotContext } from '../contexts/ballot_context';

const timeoutSeconds = IDLE_RESET_TIMEOUT_SECONDS;

export function IdlePage(): JSX.Element {
  const { endVoterSession, resetBallot } = useContext(BallotContext);
  const [countdown, setCountdown] = useState(timeoutSeconds);
  const [isLoading, setIsLoading] = useState(false);

  function onPress() {
    // do nothing
  }

  useEffect(() => {
    async function reset() {
      setIsLoading(true);
      await endVoterSession();
      resetBallot();
    }
    if (countdown === 0 && !isLoading) void reset();
  }, [countdown, endVoterSession, resetBallot, isLoading]);

  useInterval(() => {
    setCountdown((previous) => previous - 1);
  }, 1000);

  return (
    <Screen navRight>
      <Main centerChild>
        {isLoading ? (
          <Loading>Clearing ballot</Loading>
        ) : (
          <Prose textCenter>
            <H1 aria-label="Are you still voting?">Are you still voting?</H1>
            <p>
              This voting station has been inactive for more than{' '}
              {pluralize('minute', IDLE_TIMEOUT_SECONDS / 60, true)}.
            </p>
            {countdown <= timeoutSeconds / 2 && (
              <p>
                To protect your privacy, this ballot will be cleared in{' '}
                <strong>{pluralize('second', countdown, true)}</strong>.
              </p>
            )}
            <Button variant="primary" onPress={onPress}>
              Yes, I’m still voting.
            </Button>
          </Prose>
        )}
      </Main>
    </Screen>
  );
}
