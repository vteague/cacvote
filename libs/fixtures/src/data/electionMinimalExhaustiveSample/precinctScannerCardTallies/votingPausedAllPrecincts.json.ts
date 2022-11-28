/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'buffer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';

/**
 * Data of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedAllPrecincts.json encoded as base64.
 *
 * SHA-256 hash of file data: e245ed66493dd7c2be75cd2a5676258d0a3cd60b6c4bb37532fbc3102c27e4f6
 */
const resourceDataBase64 = 'ewogICJ0YWxseU1hY2hpbmVUeXBlIjogInByZWNpbmN0X3NjYW5uZXIiLAogICJ0b3RhbEJhbGxvdHNTY2FubmVkIjogMCwKICAiaXNMaXZlTW9kZSI6IGZhbHNlLAogICJwb2xsc1RyYW5zaXRpb24iOiAicGF1c2Vfdm90aW5nIiwKICAibWFjaGluZUlkIjogIjAwMDAiLAogICJ0aW1lU2F2ZWQiOiAxNjY1NjE2MDY5NzY5LAogICJ0aW1lUG9sbHNUcmFuc2l0aW9uZWQiOiAxNjY1NjE2MDY5NzY5LAogICJwcmVjaW5jdFNlbGVjdGlvbiI6IHsKICAgICJraW5kIjogIkFsbFByZWNpbmN0cyIKICB9LAogICJiYWxsb3RDb3VudHMiOiB7CiAgICAiMCxwcmVjaW5jdC0xIjogWzAsIDBdLAogICAgIjAscHJlY2luY3QtMiI6IFswLCAwXSwKICAgICIxLHByZWNpbmN0LTEiOiBbMCwgMF0sCiAgICAiMSxwcmVjaW5jdC0yIjogWzAsIDBdLAogICAgIjAsX19BTExfUFJFQ0lOQ1RTIjogWzAsIDBdLAogICAgIjEsX19BTExfUFJFQ0lOQ1RTIjogWzAsIDBdCiAgfSwKICAidGFsbGllc0J5UHJlY2luY3QiOiB7CiAgICAicHJlY2luY3QtMSI6IFsKICAgICAgWzAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgICBbMCwgMCwgMCwgMCwgMCwgMF0sCiAgICAgIFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSwKICAgICAgWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICAgIFswLCAwLCAwLCAwLCAwXQogICAgXSwKICAgICJwcmVjaW5jdC0yIjogWwogICAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICAgIFswLCAwLCAwLCAwLCAwLCAwXSwKICAgICAgWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdLAogICAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICAgIFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSwKICAgICAgWzAsIDAsIDAsIDAsIDBdCiAgICBdCiAgfSwKICAidGFsbHkiOiBbCiAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICBbMCwgMCwgMCwgMCwgMCwgMF0sCiAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0sCiAgICBbMCwgMCwgMCwgMCwgMF0KICBdCn0K';

/**
 * MIME type of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedAllPrecincts.json.
 */
export const mimeType = 'application/json';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: e245ed66493dd7c2be75cd2a5676258d0a3cd60b6c4bb37532fbc3102c27e4f6
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'votingPausedAllPrecincts.json');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedAllPrecincts.json, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: e245ed66493dd7c2be75cd2a5676258d0a3cd60b6c4bb37532fbc3102c27e4f6
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedAllPrecincts.json.
 *
 * SHA-256 hash of file data: e245ed66493dd7c2be75cd2a5676258d0a3cd60b6c4bb37532fbc3102c27e4f6
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionMinimalExhaustiveSample/precinctScannerCardTallies/votingPausedAllPrecincts.json.
 *
 * SHA-256 hash of file data: e245ed66493dd7c2be75cd2a5676258d0a3cd60b6c4bb37532fbc3102c27e4f6
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}