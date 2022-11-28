/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'buffer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';

/**
 * Data of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingResumedSinglePrecinct.json encoded as base64.
 *
 * SHA-256 hash of file data: d4f0a08faa6d65f185a7747388da43aa679f49a7e70b2e6c46ae21da3c0bf76d
 */
const resourceDataBase64 = 'ewogICJ0YWxseU1hY2hpbmVUeXBlIjogInByZWNpbmN0X3NjYW5uZXIiLAogICJ0b3RhbEJhbGxvdHNTY2FubmVkIjogMCwKICAiaXNMaXZlTW9kZSI6IGZhbHNlLAogICJwb2xsc1RyYW5zaXRpb24iOiAicmVzdW1lX3ZvdGluZyIsCiAgIm1hY2hpbmVJZCI6ICIwMDAwIiwKICAidGltZVNhdmVkIjogMTY2NTYxNzU1Mzg1MSwKICAidGltZVBvbGxzVHJhbnNpdGlvbmVkIjogMTY2NTYxNzU1Mzg1MSwKICAicHJlY2luY3RTZWxlY3Rpb24iOiB7CiAgICAia2luZCI6ICJTaW5nbGVQcmVjaW5jdCIsCiAgICAicHJlY2luY3RJZCI6ICJwcmVjaW5jdC0xIgogIH0sCiAgImJhbGxvdENvdW50cyI6IHsKICAgICIwLHByZWNpbmN0LTEiOiBbMCwgMF0sCiAgICAiMSxwcmVjaW5jdC0xIjogWzAsIDBdLAogICAgIjAsX19BTExfUFJFQ0lOQ1RTIjogWzAsIDBdLAogICAgIjEsX19BTExfUFJFQ0lOQ1RTIjogWzAsIDBdCiAgfSwKICAidGFsbGllc0J5UHJlY2luY3QiOiB7CiAgICAicHJlY2luY3QtMSI6IFsKICAgICAgWzAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgICBbMCwgMCwgMCwgMCwgMCwgMF0sCiAgICAgIFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSwKICAgICAgWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICAgIFswLCAwLCAwLCAwLCAwXQogICAgXQogIH0sCiAgInRhbGx5IjogWwogICAgWzAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgWzAsIDAsIDAsIDAsIDAsIDBdLAogICAgWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgWzAsIDAsIDAsIDAsIDBdCiAgXQp9Cg==';

/**
 * MIME type of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingResumedSinglePrecinct.json.
 */
export const mimeType = 'application/json';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: d4f0a08faa6d65f185a7747388da43aa679f49a7e70b2e6c46ae21da3c0bf76d
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'votingResumedSinglePrecinct.json');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingResumedSinglePrecinct.json, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: d4f0a08faa6d65f185a7747388da43aa679f49a7e70b2e6c46ae21da3c0bf76d
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingResumedSinglePrecinct.json.
 *
 * SHA-256 hash of file data: d4f0a08faa6d65f185a7747388da43aa679f49a7e70b2e6c46ae21da3c0bf76d
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingResumedSinglePrecinct.json.
 *
 * SHA-256 hash of file data: d4f0a08faa6d65f185a7747388da43aa679f49a7e70b2e6c46ae21da3c0bf76d
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}