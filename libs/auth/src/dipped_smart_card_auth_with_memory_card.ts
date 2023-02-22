import fetch from 'node-fetch';
import {
  assert,
  err,
  ok,
  Result,
  throwIllegalValue,
  wrapException,
} from '@votingworks/basics';
import {
  Card,
  CardSummary,
  DippedSmartCardAuth,
  User,
} from '@votingworks/types';
import {
  BooleanEnvironmentVariableName,
  generatePin,
  isFeatureFlagEnabled,
} from '@votingworks/utils';

import {
  DippedSmartCardAuthApi,
  DippedSmartCardAuthConfig,
  DippedSmartCardAuthMachineState,
} from './dipped_smart_card_auth';
import {
  ElectionManagerCardData,
  parseUserDataFromCardSummary,
  PollWorkerCardData,
  SystemAdministratorCardData,
} from './memory_card';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
global.fetch = fetch;

type AuthAction =
  | { type: 'check_card_reader'; cardSummary: CardSummary }
  | { type: 'check_pin'; cardSummary: CardSummary; pin: string }
  | { type: 'log_out' };

/**
 * An implementation of the dipped smart card auth API, backed by a memory card
 *
 * Since this is just a stopgap until we implement DippedSmartCardAuthWithJavaCard, I haven't
 * implemented the following:
 * - Locking to avoid concurrent card writes
 * - Logging
 * - Tests
 *
 * See the libs/auth README for notes on error handling
 */
export class DippedSmartCardAuthWithMemoryCard
  implements DippedSmartCardAuthApi
{
  private authStatus: DippedSmartCardAuth.AuthStatus;
  private readonly card: Card;
  private readonly config: DippedSmartCardAuthConfig;

  constructor({
    card,
    config,
  }: {
    card: Card;
    config: DippedSmartCardAuthConfig;
  }) {
    this.authStatus = DippedSmartCardAuth.DEFAULT_AUTH_STATUS;
    this.card = card;
    this.config = config;
  }

  async getAuthStatus(
    machineState: DippedSmartCardAuthMachineState
  ): Promise<DippedSmartCardAuth.AuthStatus> {
    await this.checkCardReaderAndUpdateAuthStatus(machineState);
    return this.authStatus;
  }

  async checkPin(
    machineState: DippedSmartCardAuthMachineState,
    input: { pin: string }
  ): Promise<void> {
    const cardSummary = await this.checkCardReaderAndUpdateAuthStatus(
      machineState
    );
    this.updateAuthStatus(machineState, {
      type: 'check_pin',
      cardSummary,
      pin: input.pin,
    });
  }

  async logOut(machineState: DippedSmartCardAuthMachineState): Promise<void> {
    this.updateAuthStatus(machineState, { type: 'log_out' });
    return Promise.resolve();
  }

  async programCard(
    machineState: DippedSmartCardAuthMachineState,
    input:
      | { userRole: 'system_administrator' }
      | { userRole: 'election_manager'; electionData: string }
      | { userRole: 'poll_worker' }
  ): Promise<Result<{ pin?: string }, Error>> {
    await this.checkCardReaderAndUpdateAuthStatus(machineState);
    if (this.authStatus.status !== 'logged_in') {
      return err(new Error('User is not logged in'));
    }
    if (this.authStatus.user.role !== 'system_administrator') {
      return err(new Error('User is not a system administrator'));
    }

    const { electionHash } = machineState;
    const pin = generatePin();
    try {
      switch (input.userRole) {
        case 'system_administrator': {
          const cardData: SystemAdministratorCardData = {
            t: 'system_administrator',
            p: pin,
          };
          await this.card.overrideWriteProtection();
          await this.card.writeShortValue(JSON.stringify(cardData));
          break;
        }
        case 'election_manager': {
          assert(electionHash !== undefined);
          const cardData: ElectionManagerCardData = {
            t: 'election_manager',
            h: electionHash,
            p: pin,
          };
          await this.card.overrideWriteProtection();
          await this.card.writeShortAndLongValues({
            shortValue: JSON.stringify(cardData),
            longValue: input.electionData,
          });
          break;
        }
        case 'poll_worker': {
          assert(electionHash !== undefined);
          const cardData: PollWorkerCardData = {
            t: 'poll_worker',
            h: electionHash,
          };
          await this.card.overrideWriteProtection();
          await this.card.writeShortValue(JSON.stringify(cardData));
          break;
        }
        /* istanbul ignore next: Compile-time check for completeness */
        default:
          throwIllegalValue(input, 'userRole');
      }
    } catch (error) {
      return wrapException(error);
    }
    return ok({ pin });
  }

  async unprogramCard(
    machineState: DippedSmartCardAuthMachineState
  ): Promise<Result<void, Error>> {
    await this.checkCardReaderAndUpdateAuthStatus(machineState);
    if (this.authStatus.status !== 'logged_in') {
      return err(new Error('User is not logged in'));
    }
    if (this.authStatus.user.role !== 'system_administrator') {
      return err(new Error('User is not a system administrator'));
    }

    try {
      await this.card.overrideWriteProtection();
      await this.card.writeShortAndLongValues({
        shortValue: '',
        longValue: '',
      });
    } catch (error) {
      return wrapException(error);
    }
    return ok();
  }

  private async checkCardReaderAndUpdateAuthStatus(
    machineState: DippedSmartCardAuthMachineState
  ): Promise<CardSummary> {
    const cardSummary = await this.card.readSummary();
    this.updateAuthStatus(machineState, {
      type: 'check_card_reader',
      cardSummary,
    });
    return cardSummary;
  }

  private updateAuthStatus(
    machineState: DippedSmartCardAuthMachineState,
    action: AuthAction
  ) {
    this.authStatus = this.determineNewAuthStatus(machineState, action);
  }

  private determineNewAuthStatus(
    machineState: DippedSmartCardAuthMachineState,
    action: AuthAction
  ): DippedSmartCardAuth.AuthStatus {
    const currentAuthStatus = this.authStatus;

    switch (action.type) {
      case 'check_card_reader': {
        const newAuthStatus = ((): DippedSmartCardAuth.AuthStatus => {
          switch (currentAuthStatus.status) {
            case 'logged_out': {
              switch (action.cardSummary.status) {
                case 'no_card':
                  return { status: 'logged_out', reason: 'machine_locked' };

                case 'error':
                  return { status: 'logged_out', reason: 'card_error' };

                case 'ready': {
                  const { user } = parseUserDataFromCardSummary(
                    action.cardSummary
                  );
                  const validationResult = this.validateCardUser(
                    machineState,
                    user
                  );
                  if (validationResult.isOk()) {
                    assert(
                      user &&
                        (user.role === 'system_administrator' ||
                          user.role === 'election_manager')
                    );
                    return isFeatureFlagEnabled(
                      BooleanEnvironmentVariableName.SKIP_PIN_ENTRY
                    )
                      ? { status: 'remove_card', user }
                      : { status: 'checking_pin', user };
                  }
                  return {
                    status: 'logged_out',
                    reason: validationResult.err(),
                    cardUserRole: user?.role,
                  };
                }

                /* istanbul ignore next: Compile-time check for completeness */
                default:
                  return throwIllegalValue(action.cardSummary, 'status');
              }
            }

            case 'checking_pin': {
              if (action.cardSummary.status === 'no_card') {
                return { status: 'logged_out', reason: 'machine_locked' };
              }
              return currentAuthStatus;
            }

            case 'remove_card': {
              if (action.cardSummary.status === 'no_card') {
                const { user } = currentAuthStatus;
                if (user.role === 'system_administrator') {
                  return {
                    status: 'logged_in',
                    user,
                    programmableCard: action.cardSummary,
                  };
                }
                return { status: 'logged_in', user };
              }
              return currentAuthStatus;
            }

            case 'logged_in': {
              const { user } = currentAuthStatus;
              if (user.role === 'system_administrator') {
                return {
                  ...currentAuthStatus,
                  programmableCard:
                    action.cardSummary.status === 'ready'
                      ? {
                          status: 'ready',
                          programmedUser: parseUserDataFromCardSummary(
                            action.cardSummary
                          ).user,
                        }
                      : action.cardSummary,
                };
              }
              return currentAuthStatus;
            }

            /* istanbul ignore next: Compile-time check for completeness */
            default:
              throwIllegalValue(currentAuthStatus, 'status');
          }
        })();

        return newAuthStatus;
      }

      case 'check_pin': {
        if (
          currentAuthStatus.status !== 'checking_pin' ||
          action.cardSummary.status !== 'ready'
        ) {
          return currentAuthStatus;
        }
        const { pin } = parseUserDataFromCardSummary(action.cardSummary);
        return action.pin === pin
          ? { status: 'remove_card', user: currentAuthStatus.user }
          : { ...currentAuthStatus, wrongPinEnteredAt: new Date() };
      }

      case 'log_out':
        return { status: 'logged_out', reason: 'machine_locked' };

      /* istanbul ignore next: Compile-time check for completeness */
      default:
        throwIllegalValue(action, 'type');
    }
  }

  private validateCardUser(
    machineState: DippedSmartCardAuthMachineState,
    user?: User
  ): Result<void, DippedSmartCardAuth.LoggedOut['reason']> {
    if (!user) {
      return err('invalid_user_on_card');
    }

    if (!['system_administrator', 'election_manager'].includes(user.role)) {
      return err('user_role_not_allowed');
    }

    if (user.role === 'election_manager') {
      if (!machineState.electionHash) {
        return this.config.allowElectionManagersToAccessUnconfiguredMachines
          ? ok()
          : err('machine_not_configured');
      }
      if (user.electionHash !== machineState.electionHash) {
        return err('election_manager_wrong_election');
      }
    }

    return ok();
  }
}
