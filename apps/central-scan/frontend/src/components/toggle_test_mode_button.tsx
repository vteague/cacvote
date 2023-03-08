import { Button, Modal } from '@votingworks/ui';
import React, { useCallback, useRef, useState } from 'react';
import { Prose } from './prose';

export interface Props {
  canUnconfigure: boolean;
  isTestMode: boolean;
  isTogglingTestMode: boolean;
  toggleTestMode(): void;
}

/**
 * Presents a button to toggle between test & live modes with a confirmation.
 */
export function ToggleTestModeButton({
  canUnconfigure,
  isTestMode,
  isTogglingTestMode,
  toggleTestMode,
}: Props): JSX.Element {
  const [isConfirming, setIsConfirming] = useState(isTogglingTestMode);
  const defaultButtonRef = useRef<Button>(null);

  const toggleIsConfirming = useCallback(() => {
    /* istanbul ignore else - just catches the case of clicking the overlay when toggling */
    if (!isTogglingTestMode) {
      setIsConfirming((prev) => !prev);
    }
  }, [isTogglingTestMode, setIsConfirming]);

  const focusDefaultButton = useCallback(() => {
    defaultButtonRef.current?.focus();
  }, []);

  return (
    <React.Fragment>
      <Button
        onPress={toggleIsConfirming}
        disabled={
          (!canUnconfigure && !isTestMode) || isTogglingTestMode || isConfirming
        }
      >
        {isTogglingTestMode
          ? 'Toggling…'
          : isTestMode
          ? 'Toggle to Official Ballot Mode'
          : 'Toggle to Test Ballot Mode'}
      </Button>
      {isConfirming && (
        <Modal
          centerContent
          content={
            <Prose textCenter>
              <h1>
                {isTogglingTestMode
                  ? isTestMode
                    ? 'Toggling to Official Ballot Mode'
                    : 'Toggling to Test Ballot Mode'
                  : isTestMode
                  ? 'Toggle to Official Ballot Mode'
                  : 'Toggle to Test Ballot Mode'}
              </h1>
              <p>
                {isTogglingTestMode
                  ? 'Zeroing out scanned ballots and reloading…'
                  : `Toggling to ${
                      isTestMode ? 'Official' : 'Test'
                    } Ballot Mode will zero out your scanned ballots. Are you sure?`}
              </p>
            </Prose>
          }
          actions={
            !isTogglingTestMode && (
              <React.Fragment>
                <Button
                  data-testid="confirm-toggle"
                  ref={defaultButtonRef}
                  variant="primary"
                  onPress={toggleTestMode}
                >
                  {isTestMode
                    ? 'Toggle to Official Ballot Mode'
                    : 'Toggle to Test Ballot Mode'}
                </Button>
                <Button onPress={toggleIsConfirming}>Cancel</Button>
              </React.Fragment>
            )
          }
          onOverlayClick={toggleIsConfirming}
          onAfterOpen={focusDefaultButton}
        />
      )}
    </React.Fragment>
  );
}
