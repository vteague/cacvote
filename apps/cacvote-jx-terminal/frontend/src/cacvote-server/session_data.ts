import {
  BallotStyleId,
  ElectionDefinition,
  PrecinctId,
  safeParseElectionDefinition,
} from '@votingworks/types';
import { Buffer } from 'buffer';
import { z } from 'zod';
import { DateTime } from 'luxon';
import {
  Base64StringSchema,
  Iso8601DateSchema,
  JurisdictionCode,
  JurisdictionCodeSchema,
  Uuid,
  UuidSchema,
} from './types';

export interface VerificationStatusSuccess {
  type: 'success';
  commonAccessCardId: string;
  displayName: string;
}

export const VerificationStatusSuccessSchema: z.ZodSchema<VerificationStatusSuccess> =
  z.object({
    type: z.literal('success'),
    commonAccessCardId: z.string(),
    displayName: z.string(),
  });

export interface VerificationStatusFailure {
  type: 'failure';
}

export const VerificationStatusFailureSchema: z.ZodSchema<VerificationStatusFailure> =
  z.object({
    type: z.literal('failure'),
  });

export interface VerificationStatusError {
  type: 'error';
  message: string;
}

export const VerificationStatusErrorSchema: z.ZodSchema<VerificationStatusError> =
  z.object({
    type: z.literal('error'),
    message: z.string(),
  });

export interface VerificationStatusUnknown {
  type: 'unknown';
}

export const VerificationStatusUnknownSchema: z.ZodSchema<VerificationStatusUnknown> =
  z.object({
    type: z.literal('unknown'),
  });

export type VerificationStatus =
  | VerificationStatusSuccess
  | VerificationStatusFailure
  | VerificationStatusError
  | VerificationStatusUnknown;

export const VerificationStatusSchema: z.ZodSchema<VerificationStatus> =
  z.union([
    VerificationStatusSuccessSchema,
    VerificationStatusFailureSchema,
    VerificationStatusErrorSchema,
    VerificationStatusUnknownSchema,
  ]);

export interface EncryptedElectionTally {
  jurisdictionCode: JurisdictionCode;
  electionObjectId: Uuid;
  electionguardEncryptedTally: Buffer;
}

export const EncryptedElectionTallySchema: z.ZodSchema<EncryptedElectionTally> =
  z.object({
    jurisdictionCode: JurisdictionCodeSchema,
    electionObjectId: UuidSchema,
    electionguardEncryptedTally: Base64StringSchema,
  });

export interface EncryptedElectionTallyPresenter {
  encryptedElectionTally: EncryptedElectionTally;
  createdAt: DateTime;
  syncedAt?: DateTime;
}

export const EncryptedElectionTallyPresenterSchema: z.ZodSchema<EncryptedElectionTallyPresenter> =
  z.object({
    encryptedElectionTally: EncryptedElectionTallySchema,
    createdAt: Iso8601DateSchema,
    syncedAt: Iso8601DateSchema.optional(),
  });

export interface DecryptedElectionTally {
  jurisdictionCode: JurisdictionCode;
  electionObjectId: Uuid;
  electionguardDecryptedTally: Buffer;
}

export const DecryptedElectionTallySchema: z.ZodSchema<DecryptedElectionTally> =
  z.object({
    jurisdictionCode: JurisdictionCodeSchema,
    electionObjectId: UuidSchema,
    electionguardDecryptedTally: Base64StringSchema,
  });

export interface DecryptedElectionTallyPresenter {
  decryptedElectionTally: DecryptedElectionTally;
  createdAt: DateTime;
  syncedAt?: DateTime;
}

export const DecryptedElectionTallyPresenterSchema: z.ZodSchema<DecryptedElectionTallyPresenter> =
  z.object({
    decryptedElectionTally: DecryptedElectionTallySchema,
    createdAt: Iso8601DateSchema,
    syncedAt: Iso8601DateSchema.optional(),
  });

export interface ElectionInfo {
  jurisdictionCode: JurisdictionCode;
  electionDefinition: ElectionDefinition;
  mailingAddress: string;
  electionguardElectionMetadataBlob: Buffer;
}

const ElectionDefinitionAsBase64Schema: z.ZodSchema<ElectionDefinition> =
  Base64StringSchema.transform((buffer) =>
    safeParseElectionDefinition(buffer.toString('utf8')).unsafeUnwrap()
  ) as unknown as z.ZodSchema<ElectionDefinition>;

export const ElectionInfoSchema: z.ZodSchema<ElectionInfo> = z.object({
  jurisdictionCode: JurisdictionCodeSchema,
  electionDefinition: ElectionDefinitionAsBase64Schema,
  mailingAddress: z.string(),
  electionguardElectionMetadataBlob: Base64StringSchema,
});

export interface ElectionPresenter {
  id: Uuid;
  election: ElectionInfo;
  encryptedTally?: EncryptedElectionTallyPresenter;
  decryptedTally?: DecryptedElectionTallyPresenter;
}

export const ElectionPresenterSchema: z.ZodSchema<ElectionPresenter> = z.object(
  {
    id: UuidSchema,
    election: ElectionInfoSchema,
    encryptedTally: EncryptedElectionTallyPresenterSchema.optional(),
    decryptedTally: DecryptedElectionTallyPresenterSchema.optional(),
  }
);

export interface RegistrationRequest {
  commonAccessCardId: string;
  jurisdictionCode: JurisdictionCode;
  givenName: string;
  familyName: string;
}

export const RegistrationRequestSchema: z.ZodSchema<RegistrationRequest> =
  z.object({
    commonAccessCardId: z.string(),
    jurisdictionCode: JurisdictionCodeSchema,
    givenName: z.string(),
    familyName: z.string(),
  });

export interface RegistrationRequestPresenter {
  id: Uuid;
  displayName: string;
  registrationRequest: RegistrationRequest;
  createdAt: DateTime;
}

export const RegistrationRequestPresenterSchema: z.ZodSchema<RegistrationRequestPresenter> =
  z.object({
    id: UuidSchema,
    displayName: z.string(),
    registrationRequest: RegistrationRequestSchema,
    createdAt: Iso8601DateSchema,
  });

export interface Registration {
  commonAccessCardId: string;
  jurisdictionCode: JurisdictionCode;
  registrationRequestObjectId: Uuid;
  electionObjectId: Uuid;
  ballotStyleId: BallotStyleId;
  precinctId: PrecinctId;
}

export const RegistrationSchema: z.ZodSchema<Registration> = z.object({
  commonAccessCardId: z.string(),
  jurisdictionCode: JurisdictionCodeSchema,
  registrationRequestObjectId: UuidSchema,
  electionObjectId: UuidSchema,
  ballotStyleId: z.string(),
  precinctId: z.string(),
});

export interface RegistrationPresenter {
  id: Uuid;
  displayName: string;
  electionTitle: string;
  electionHash: string;
  registration: Registration;
  createdAt: DateTime;
  isSynced: boolean;
}

export const RegistrationPresenterSchema: z.ZodSchema<RegistrationPresenter> =
  z.object({
    id: UuidSchema,
    displayName: z.string(),
    electionTitle: z.string(),
    electionHash: z.string(),
    registration: RegistrationSchema,
    createdAt: Iso8601DateSchema,
    isSynced: z.boolean(),
  });

export interface CastBallot {
  commonAccessCardId: string;
  jurisdictionCode: JurisdictionCode;
  registrationRequestObjectId: Uuid;
  registrationObjectId: Uuid;
  electionObjectId: Uuid;
  electionguardEncryptedBallot: string;
}

export const CastBallotSchema: z.ZodSchema<CastBallot> = z.object({
  commonAccessCardId: z.string(),
  jurisdictionCode: JurisdictionCodeSchema,
  registrationRequestObjectId: UuidSchema,
  registrationObjectId: UuidSchema,
  electionObjectId: UuidSchema,
  electionguardEncryptedBallot: z.string(),
});

export interface CastBallotPresenter {
  castBallot: CastBallot;
  registrationRequest: RegistrationRequest;
  registration: Registration;
  registrationId: Uuid;
  verificationStatus: VerificationStatus;
  createdAt: DateTime;
}

export const CastBallotPresenterSchema: z.ZodSchema<CastBallotPresenter> =
  z.object({
    castBallot: CastBallotSchema,
    registrationRequest: RegistrationRequestSchema,
    registration: RegistrationSchema,
    registrationId: UuidSchema,
    verificationStatus: VerificationStatusSchema,
    createdAt: Iso8601DateSchema,
  });

export interface AuthenticatedSessionData {
  type: 'authenticated';
  jurisdictionCode: JurisdictionCode;
  elections: ElectionPresenter[];
  pendingRegistrationRequests: RegistrationRequestPresenter[];
  registrations: RegistrationPresenter[];
  castBallots: CastBallotPresenter[];
}

export const AuthenticatedSessionDataSchema: z.ZodSchema<AuthenticatedSessionData> =
  z.object({
    type: z.literal('authenticated'),
    jurisdictionCode: JurisdictionCodeSchema,
    elections: z.array(ElectionPresenterSchema),
    pendingRegistrationRequests: z.array(RegistrationRequestPresenterSchema),
    registrations: z.array(RegistrationPresenterSchema),
    castBallots: z.array(CastBallotPresenterSchema),
  });

export interface UnauthenticatedSessionData {
  type: 'unauthenticated';
  hasSmartcard: boolean;
}

export const UnauthenticatedSessionDataSchema: z.ZodSchema<UnauthenticatedSessionData> =
  z.object({
    type: z.literal('unauthenticated'),
    hasSmartcard: z.boolean(),
  });

export type SessionData = UnauthenticatedSessionData | AuthenticatedSessionData;

export const SessionDataSchema: z.ZodSchema<SessionData> = z.union([
  UnauthenticatedSessionDataSchema,
  AuthenticatedSessionDataSchema,
]);
