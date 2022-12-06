import { unsafeParse } from '@votingworks/types';
import { Scan } from '@votingworks/api';
import { fetchJson } from '@votingworks/utils';
import { rootDebug } from '../utils/debug';

const debug = rootDebug.extend('api:scan');

export async function getStatus(): Promise<Scan.PrecinctScannerStatus> {
  return unsafeParse(
    Scan.GetPrecinctScannerStatusResponseSchema,
    await fetchJson('/precinct-scanner/scanner/status')
  );
}

export async function scanBallot(): Promise<void> {
  await fetchJson('/precinct-scanner/scanner/scan', { method: 'POST' });
}

export async function acceptBallot(): Promise<void> {
  await fetchJson('/precinct-scanner/scanner/accept', { method: 'POST' });
}

export async function returnBallot(): Promise<void> {
  await fetchJson('/precinct-scanner/scanner/return', { method: 'POST' });
}

export async function calibrate(): Promise<boolean> {
  const result = unsafeParse(
    Scan.CalibrateResponseSchema,
    await fetchJson('/precinct-scanner/scanner/calibrate', { method: 'POST' })
  );
  return result.status === 'ok';
}

// Returns CVR file which does not include any write-in images
export async function getExportWithoutImages(): Promise<string> {
  const response = await fetch('/precinct-scanner/export', {
    method: 'post',
    body: JSON.stringify({ skipImages: true }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (response.status !== 200) {
    debug('failed to get scan export: %o', response);
    throw new Error('failed to generate scan export');
  }
  return await response.text();
}
