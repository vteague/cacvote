import { NODE_ENV } from '@votingworks/backend';
import { safeParseInt, unsafeParse } from '@votingworks/types';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import fs from 'fs';
import { join } from 'path';
import { z } from 'zod';

// https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
const dotEnvPath = '.env';
const dotenvFiles: string[] = [
  `${dotEnvPath}.${NODE_ENV}.local`,
  // Don't include `.env.local` for `test` environment
  // since normally you expect tests to produce the same
  // results for everyone
  NODE_ENV !== 'test' ? `${dotEnvPath}.local` : '',
  `${dotEnvPath}.${NODE_ENV}`,
  dotEnvPath,
  NODE_ENV !== 'test' ? `../../../${dotEnvPath}.local` : '',
  `../../../${dotEnvPath}`,
].filter(Boolean);

// Load environment variables from .env* files. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.  Variable expansion is supported in .env files.
// https://github.com/motdotla/dotenv
// https://github.com/motdotla/dotenv-expand
for (const dotenvFile of dotenvFiles) {
  if (fs.existsSync(dotenvFile)) {
    dotenvExpand.expand(dotenv.config({ path: dotenvFile }));
  }
}

const BASE_PORT = safeParseInt(process.env.BASE_PORT).ok() || 3000;

/**
 * Default port for the RaveMark backend.
 */
export const PORT = safeParseInt(process.env.PORT).ok() || BASE_PORT + 2;

/**
 * Where should the database and audio files go?
 */
export const RAVE_MARK_WORKSPACE =
  process.env.RAVE_MARK_WORKSPACE ??
  (NODE_ENV === 'development'
    ? join(__dirname, '../dev-workspace')
    : undefined);

/**
 * Is this running as part of an integration test?
 */
export const IS_INTEGRATION_TEST = process.env.IS_INTEGRATION_TEST === 'true';

/**
 * RAVE Server URL.
 */
export const RAVE_URL = process.env.RAVE_URL
  ? new URL(process.env.RAVE_URL)
  : NODE_ENV === 'development' || typeof jest !== 'undefined'
  ? new URL('http://localhost:8000')
  : undefined;

/**
 * Should we mock the RAVE Server?
 */
export const USE_MOCK_RAVE_SERVER =
  (process.env.USE_MOCK_RAVE_SERVER === 'true' || IS_INTEGRATION_TEST) &&
  process.env.USE_MOCK_RAVE_SERVER !== 'false';

/**
 * What is the name of the mailing label printer?
 */
export const MAILING_LABEL_PRINTER = unsafeParse(
  z.string(),
  process.env.MAILING_LABEL_PRINTER
);

/**
 * Delete ballots cast in the last N minutes.
 */
export const DELETE_RECENTLY_CAST_BALLOTS_MINUTES = safeParseInt(
  process.env.DELETE_RECENTLY_CAST_BALLOTS_MINUTES,
  { min: 1 }
).ok();
