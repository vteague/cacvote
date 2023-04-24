import { ConverterClientTypeSchema } from '@votingworks/types';
import { ZodSchema } from 'zod';
import { throwIllegalValue } from '@votingworks/basics';
import { asBoolean } from './as_boolean';

export enum BooleanEnvironmentVariableName {
  // Enables the write in adjudication tab in VxAdmin, and enables exporting images with write ins in the scan service
  WRITE_IN_ADJUDICATION = 'REACT_APP_VX_ENABLE_WRITE_IN_ADJUDICATION',
  // When enabled VxAdmin will generate 000000 as the PIN for any created smartcard.
  ALL_ZERO_SMARTCARD_PIN = 'REACT_APP_VX_ENABLE_ALL_ZERO_SMARTCARD_PIN_GENERATION',
  // When enabled the "You must connect a card reader" screens will not appear throughout all apps.
  DISABLE_CARD_READER_CHECK = 'REACT_APP_VX_DISABLE_CARD_READER_CHECK',
  // Enables livecheck in VxScan.
  LIVECHECK = 'REACT_APP_VX_ENABLE_LIVECHECK',
  // Whether overvotes can be cast (this exists entirely for NH special case right now).
  DISALLOW_CASTING_OVERVOTES = 'REACT_APP_VX_DISALLOW_CASTING_OVERVOTES',
  // Enables the React Query Devtools in development.
  ENABLE_REACT_QUERY_DEVTOOLS = 'REACT_APP_VX_ENABLE_REACT_QUERY_DEVTOOLS',
  // Skips PIN entry during authentication
  SKIP_PIN_ENTRY = 'REACT_APP_VX_SKIP_PIN_ENTRY',
  // Use mock cards instead of a real card reader. Meant for development and integration tests.
  // Real smart cards will not work when this flag is enabled.
  USE_MOCK_CARDS = 'REACT_APP_VX_USE_MOCK_CARDS',
  // Skips election hash checks when importing CVRs to allow using old fixtures
  // in development even as their respective election definitions change.
  SKIP_CVR_ELECTION_HASH_CHECK = 'REACT_APP_VX_SKIP_CVR_ELECTION_HASH_CHECK',
  // Skips election hash checks when scanning to allow using old fixtures in
  // development even as their respective election definitions change.
  SKIP_SCAN_ELECTION_HASH_CHECK = 'REACT_APP_VX_SKIP_SCAN_ELECTION_HASH_CHECK',
}

// This is not fully generic since string variables may want the getter to return a custom type.
export enum StringEnvironmentVariableName {
  // Converter for input/output files in VxAdmin
  CONVERTER = 'REACT_APP_VX_CONVERTER',
}

export interface BooleanEnvironmentConfig {
  name: BooleanEnvironmentVariableName;
  // When false this flag will never be enabled when NODE_ENV is production.
  allowInProduction: boolean;
  // When true the script that generates .env files will turn this flag on by default.
  autoEnableInDevelopment: boolean;
}

export interface StringEnvironmentConfig {
  name: StringEnvironmentVariableName;
  defaultValue: string; // Default value for autogenerated .env files
  zodSchema?: ZodSchema;
}

export function getEnvironmentVariable(
  name: BooleanEnvironmentVariableName | StringEnvironmentVariableName
): string | undefined {
  switch (name) {
    case BooleanEnvironmentVariableName.WRITE_IN_ADJUDICATION:
      return process.env.REACT_APP_VX_ENABLE_WRITE_IN_ADJUDICATION;
    case BooleanEnvironmentVariableName.ALL_ZERO_SMARTCARD_PIN:
      return process.env.REACT_APP_VX_ENABLE_ALL_ZERO_SMARTCARD_PIN_GENERATION;
    case BooleanEnvironmentVariableName.DISABLE_CARD_READER_CHECK:
      return process.env.REACT_APP_VX_DISABLE_CARD_READER_CHECK;
    case BooleanEnvironmentVariableName.LIVECHECK:
      return process.env.REACT_APP_VX_ENABLE_LIVECHECK;
    case BooleanEnvironmentVariableName.DISALLOW_CASTING_OVERVOTES:
      return process.env.REACT_APP_VX_DISALLOW_CASTING_OVERVOTES;
    case BooleanEnvironmentVariableName.ENABLE_REACT_QUERY_DEVTOOLS:
      return process.env.REACT_APP_VX_ENABLE_REACT_QUERY_DEVTOOLS;
    case BooleanEnvironmentVariableName.SKIP_PIN_ENTRY:
      return process.env.REACT_APP_VX_SKIP_PIN_ENTRY;
    case BooleanEnvironmentVariableName.USE_MOCK_CARDS:
      return process.env.REACT_APP_VX_USE_MOCK_CARDS;
    case BooleanEnvironmentVariableName.SKIP_CVR_ELECTION_HASH_CHECK:
      return process.env.REACT_APP_VX_SKIP_CVR_ELECTION_HASH_CHECK;
    case BooleanEnvironmentVariableName.SKIP_SCAN_ELECTION_HASH_CHECK:
      return process.env.REACT_APP_VX_SKIP_SCAN_ELECTION_HASH_CHECK;
    case StringEnvironmentVariableName.CONVERTER:
      return process.env.REACT_APP_VX_CONVERTER;
    /* istanbul ignore next compile time check */
    default:
      throwIllegalValue(name);
  }
}

export function getBooleanEnvVarConfig(
  name: BooleanEnvironmentVariableName
): BooleanEnvironmentConfig {
  switch (name) {
    case BooleanEnvironmentVariableName.WRITE_IN_ADJUDICATION:
      return {
        name,
        allowInProduction: true,
        autoEnableInDevelopment: true,
      };
    case BooleanEnvironmentVariableName.ALL_ZERO_SMARTCARD_PIN:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: true,
      };
    case BooleanEnvironmentVariableName.DISABLE_CARD_READER_CHECK:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: false,
      };
    case BooleanEnvironmentVariableName.LIVECHECK:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: true,
      };
    case BooleanEnvironmentVariableName.DISALLOW_CASTING_OVERVOTES:
      return {
        name,
        allowInProduction: true,
        autoEnableInDevelopment: false,
      };
    case BooleanEnvironmentVariableName.ENABLE_REACT_QUERY_DEVTOOLS:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: false,
      };
    case BooleanEnvironmentVariableName.SKIP_PIN_ENTRY:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: false,
      };
    case BooleanEnvironmentVariableName.USE_MOCK_CARDS:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: false,
      };
    case BooleanEnvironmentVariableName.SKIP_CVR_ELECTION_HASH_CHECK:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: false,
      };
    case BooleanEnvironmentVariableName.SKIP_SCAN_ELECTION_HASH_CHECK:
      return {
        name,
        allowInProduction: false,
        autoEnableInDevelopment: false,
      };
    /* istanbul ignore next compile time check */
    default:
      throwIllegalValue(name);
  }
}

export function getStringEnvVarConfig(
  name: StringEnvironmentVariableName
): StringEnvironmentConfig {
  switch (name) {
    case StringEnvironmentVariableName.CONVERTER:
      return {
        name,
        defaultValue: 'ms-sems',
        zodSchema: ConverterClientTypeSchema,
      };
    /* istanbul ignore next compile time check */
    default:
      throwIllegalValue(name);
  }
}

/**
 * We use a custom environment variable for this instead of overloading NODE_ENV, e.g.
 * NODE_ENV=test or NODE_ENV=integration-test, because we want integration tests to use
 * NODE_ENV=production to ensure that they're mimicking production as closely as possible.
 */
export function isIntegrationTest(): boolean {
  return asBoolean(process.env.IS_INTEGRATION_TEST);
}
