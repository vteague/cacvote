import { buildCastVoteRecord, VX_MACHINE_ID } from '@votingworks/backend';
import {
  Optional,
  Result,
  assert,
  asyncResultBlock,
  err,
  find,
  iter,
  ok,
} from '@votingworks/basics';
import * as grout from '@votingworks/grout';
import {
  BallotIdSchema,
  BallotStyleId,
  BallotType,
  Id,
  PrecinctId,
  VotesDict,
  unsafeParse,
} from '@votingworks/types';
import { Buffer } from 'buffer';
import express, { Application } from 'express';
import { isDeepStrictEqual } from 'util';
import { execFileSync } from 'child_process';
import { cac } from '@votingworks/auth';
import { IS_INTEGRATION_TEST, MAILING_LABEL_PRINTER } from './globals';
import * as mailingLabel from './mailing_label';
import { RaveServerClient } from './rave_server_client';
import { Auth, AuthStatus } from './types/auth';
import { ClientId, RegistrationRequest, ServerId } from './types/db';
import { Workspace } from './workspace';

export type VoterStatus =
  | 'unregistered'
  | 'registration_pending'
  | 'registered'
  | 'voted';

export interface CreateTestVoterInput {
  /**
   * Whether or not the voter should be an admin.
   */
  isAdmin?: boolean;

  jurisdictionId?: string;

  registrationRequest?: {
    /**
     * Voter's given name, i.e. first name.
     */
    givenName?: string;

    /**
     * Voter's family name, i.e. last name.
     */
    familyName?: string;
  };

  registration?: {
    /**
     * Election definition as a JSON string.
     */
    electionData?: string;

    /**
     * Precinct ID to register the voter to.
     */
    precinctId?: PrecinctId;

    /**
     * Ballot style ID to register the voter to.
     */
    ballotStyleId?: BallotStyleId;
  };
}

function buildApi({
  auth,
  workspace,
  raveServerClient,
}: {
  auth: Auth;
  workspace: Workspace;
  raveServerClient: RaveServerClient;
}) {
  async function getAuthStatus(): Promise<AuthStatus> {
    return await auth.getAuthStatus();
  }

  function assertIsIntegrationTest() {
    if (!IS_INTEGRATION_TEST) {
      throw new Error('This is not an integration test');
    }
  }

  return grout.createApi({
    getJurisdictions() {
      return workspace.store.getJurisdictions();
    },

    getAuthStatus,

    checkPin(input: { pin: string }) {
      return auth.checkPin(input.pin);
    },

    async getVoterStatus(): Promise<
      Optional<{ status: VoterStatus; isAdmin: boolean }>
    > {
      const authStatus: AuthStatus = await getAuthStatus();

      if (authStatus.status !== 'has_card') {
        return undefined;
      }

      const { commonAccessCardId } = authStatus.card;
      const isAdmin = workspace.store.isAdmin(commonAccessCardId);
      const registrations =
        workspace.store.getRegistrations(commonAccessCardId);

      if (registrations.length === 0) {
        const registrationRequests =
          workspace.store.getRegistrationRequests(commonAccessCardId);

        return {
          status:
            registrationRequests.length > 0
              ? 'registration_pending'
              : 'unregistered',
          isAdmin,
        };
      }

      // TODO: support multiple registrations
      const registration = registrations[0];
      assert(registration);
      const selection =
        workspace.store.getPrintedBallotCastVoteRecordForRegistration(
          registration.id
        );

      return { status: selection ? 'voted' : 'registered', isAdmin };
    },

    async getRegistrationRequests(): Promise<RegistrationRequest[]> {
      const authStatus = await getAuthStatus();

      if (authStatus.status !== 'has_card') {
        return [];
      }

      return workspace.store.getRegistrationRequests(
        authStatus.card.commonAccessCardId
      );
    },

    async createVoterRegistration(input: {
      jurisdictionId: ServerId;
      givenName: string;
      familyName: string;
      pin: string;
    }): Promise<
      Result<
        { id: Id },
        { type: 'not_logged_in' | 'incorrect_pin'; message: string }
      >
    > {
      const authStatus = await getAuthStatus();

      if (authStatus.status !== 'has_card') {
        return err({ type: 'not_logged_in', message: 'Not logged in' });
      }

      if (!(await auth.checkPin(input.pin))) {
        return err({ type: 'incorrect_pin', message: 'Incorrect PIN' });
      }

      const id = ClientId();
      workspace.store.createRegistrationRequest({
        id,
        jurisdictionId: input.jurisdictionId,
        commonAccessCardId: authStatus.card.commonAccessCardId,
        givenName: input.givenName,
        familyName: input.familyName,
      });
      return ok({ id });
    },

    async getElectionConfiguration() {
      const authStatus = await getAuthStatus();

      if (authStatus.status !== 'has_card') {
        return undefined;
      }

      const { commonAccessCardId } = authStatus.card;
      const registrations =
        workspace.store.getRegistrations(commonAccessCardId);
      // TODO: Handle multiple registrations
      const registration = registrations[0];

      if (!registration) {
        return undefined;
      }

      const electionDefinition = workspace.store.getRegistrationElection(
        registration.id
      );

      if (!electionDefinition) {
        return undefined;
      }

      return {
        electionDefinition,
        ballotStyleId: registration.ballotStyleId,
        precinctId: registration.precinctId,
      };
    },

    castBallot(input: {
      votes: VotesDict;
      pin: string;
    }): Promise<Result<ClientId, cac.GenerateSignatureError>> {
      return asyncResultBlock<ClientId, cac.GenerateSignatureError>(
        async (fail) => {
          const authStatus = await getAuthStatus();

          if (authStatus.status !== 'has_card') {
            throw new Error('Not logged in');
          }

          const { commonAccessCardId } = authStatus.card;
          const registrations =
            workspace.store.getRegistrations(commonAccessCardId);
          // TODO: Handle multiple registrations
          const registration = registrations[0];

          if (!registration) {
            throw new Error('Not registered');
          }

          const electionDefinition = workspace.store.getRegistrationElection(
            registration.id
          );

          if (!electionDefinition) {
            throw new Error('no election definition found for registration');
          }

          const ballotId = ClientId();
          const castVoteRecordId = unsafeParse(BallotIdSchema, ballotId);
          const castVoteRecord = buildCastVoteRecord({
            electionDefinition,
            electionId: electionDefinition.electionHash,
            scannerId: VX_MACHINE_ID,
            // TODO: what should the batch ID be?
            batchId: '',
            castVoteRecordId,
            interpretation: {
              type: 'InterpretedBmdPage',
              metadata: {
                ballotStyleId: registration.ballotStyleId,
                precinctId: registration.precinctId,
                ballotType: BallotType.Absentee,
                electionHash: electionDefinition.electionHash,
                // TODO: support test mode
                isTestMode: false,
              },
              votes: input.votes,
            },
            ballotMarkingMode: 'machine',
          });

          const commonAccessCardCertificate = await auth.getCertificate();
          assert(commonAccessCardCertificate);
          const castVoteRecordJson = JSON.stringify(castVoteRecord);
          const signature = (
            await auth.generateSignature(
              Buffer.from(castVoteRecordJson, 'utf-8'),
              { pin: input.pin }
            )
          ).okOrElse(fail);

          const pdf = await mailingLabel.buildPdf();

          execFileSync(
            'lpr',
            ['-P', MAILING_LABEL_PRINTER, '-o', 'media=Custom.4x6in'],
            { input: pdf }
          );

          return workspace.store.createCastBallot({
            id: ballotId,
            registrationId: registration.clientId,
            commonAccessCardCertificate,
            castVoteRecord: Buffer.from(castVoteRecordJson),
            castVoteRecordSignature: signature,
          });
        }
      );
    },

    async sync() {
      const authStatus = await getAuthStatus();
      assert(
        authStatus.status === 'has_card' && authStatus.isAdmin,
        'not logged in as admin'
      );

      void raveServerClient.sync({ authStatus });
    },

    getServerSyncStatus() {
      return {
        attempts: workspace.store.getServerSyncAttempts(),
        status: workspace.store.getSyncStatus(),
      };
    },

    logOut() {
      return auth.logOut();
    },

    createTestVoter(input: CreateTestVoterInput) {
      assertIsIntegrationTest();

      function createUniqueCommonAccessCardId(): Id {
        const tenRandomDigits = Math.floor(Math.random() * 1e10).toString();
        return `test-${tenRandomDigits.toString().padStart(10, '0')}`;
      }

      const commonAccessCardId = createUniqueCommonAccessCardId();
      if (input.isAdmin) {
        workspace.store.createAdmin({
          machineId: VX_MACHINE_ID,
          commonAccessCardId,
        });
      }

      const jurisdictionId = input.jurisdictionId
        ? (input.jurisdictionId as ServerId)
        : ServerId();

      if (input.registrationRequest || input.registration) {
        const registrationRequestId = ClientId();

        workspace.store.createRegistrationRequest({
          id: registrationRequestId,
          jurisdictionId,
          commonAccessCardId,
          givenName: input.registrationRequest?.givenName ?? 'Rebecca',
          familyName: input.registrationRequest?.familyName ?? 'Welton',
        });

        if (input.registration?.electionData) {
          const electionId = ClientId();
          workspace.store.createElection({
            id: electionId,
            jurisdictionId,
            definition: Buffer.from(input.registration.electionData),
          });
          const electionRecord = workspace.store.getElection({
            clientId: electionId,
          });
          assert(electionRecord);

          const { registration } = input;
          const ballotStyle = registration.ballotStyleId
            ? find(
                electionRecord.electionDefinition.election.ballotStyles,
                ({ id }) => id === registration.ballotStyleId
              )
            : electionRecord.electionDefinition.election.ballotStyles[0];
          assert(ballotStyle);

          const precinctId = registration.precinctId
            ? find(
                ballotStyle.precincts,
                (id) => id === registration.precinctId
              )
            : ballotStyle.precincts[0];
          assert(typeof precinctId === 'string');

          workspace.store.createRegistration({
            id: ClientId(),
            registrationRequestId,
            jurisdictionId,
            electionId,
            precinctId,
            ballotStyleId: ballotStyle.id,
          });
        }
      }

      return { commonAccessCardId };
    },

    async getTestVoterCastVoteRecord() {
      assertIsIntegrationTest();

      const authStatus = await getAuthStatus();

      if (authStatus.status !== 'has_card') {
        throw new Error('Not logged in');
      }

      const { commonAccessCardId } = authStatus.card;
      const mostRecentVotes = iter(
        workspace.store.getRegistrations(commonAccessCardId)
      )
        .flatMap((registration) => {
          const selection =
            workspace.store.getPrintedBallotCastVoteRecordForRegistration(
              registration.id
            );
          return selection ? [selection] : [];
        })
        .first();

      if (!mostRecentVotes) {
        throw new Error('No votes found');
      }

      return mostRecentVotes;
    },

    /**
     * For testing purposes only.
     *
     * ```sh
     * curl -d '{}' -H 'Content-Type: application/json' http://localhost:3000/api/createMailingLabel \
     * | jq -r '.__grout_value' \
     * | base64 -d \
     * > /tmp/label.pdf
     * ```
     */
    async createMailingLabel() {
      return await mailingLabel.buildPdf();
    },
  });
}

export type Api = ReturnType<typeof buildApi>;

export function buildApp({
  auth,
  workspace,
  raveServerClient,
}: {
  auth: Auth;
  workspace: Workspace;
  raveServerClient: RaveServerClient;
}): Application {
  const app: Application = express();
  const api = buildApi({ auth, workspace, raveServerClient });

  app.use('/api/watchAuthStatus', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let timeout: NodeJS.Timeout | undefined;
    let lastAuthStatus: AuthStatus | undefined;

    async function sendUpdate() {
      const authStatus = await api.getAuthStatus();

      if (!isDeepStrictEqual(authStatus, lastAuthStatus)) {
        lastAuthStatus = authStatus;
        res.write(`data: ${grout.serialize(authStatus)}\n\n`);
      }

      timeout = setTimeout(
        sendUpdate,
        10 /* AUTH_STATUS_POLLING_INTERVAL_MS */
      );
    }

    req.on('close', () => {
      clearTimeout(timeout);
      res.end();
    });

    void sendUpdate();
  });

  app.use('/api', grout.buildRouter(api, express));
  return app;
}