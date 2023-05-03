/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import * as fs from 'fs';
import { tmpdir } from 'os';
import { resolve, sep } from 'path';

const copiedDirectories: string[] = [];

if (typeof jest !== 'undefined') {
  afterAll(() => {
    for (const copiedDirectory of copiedDirectories) {
      fs.rmSync(copiedDirectory, { recursive: true, force: true });
    }
  });
}

export function asDirectoryPath(): string {
  const tmpDir = fs.mkdtempSync(tmpdir() + sep);
  const resolved = resolve(
    __dirname,
    '../../../../data/electionGridLayoutNewHampshireAmherst/cvr-files/standard'
  );
  fs.cpSync(resolved, tmpDir, { recursive: true });
  copiedDirectories.push(tmpDir);
  return tmpDir;
}

