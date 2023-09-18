/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'buffer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';

/**
 * Data of data/systemSettings.json encoded as base64.
 *
 * SHA-256 hash of file data: 6de7a0d93148ddb9cabbd0b94ed5308b09e149dd011e4a6e0d9212c7e54a94cd
 */
const resourceDataBase64 = 'ewogICJhdXRoIjogewogICAgImFyZVBvbGxXb3JrZXJDYXJkUGluc0VuYWJsZWQiOiBmYWxzZSwKICAgICJpbmFjdGl2ZVNlc3Npb25UaW1lTGltaXRNaW51dGVzIjogMzAsCiAgICAibnVtSW5jb3JyZWN0UGluQXR0ZW1wdHNBbGxvd2VkQmVmb3JlQ2FyZExvY2tvdXQiOiA1LAogICAgIm92ZXJhbGxTZXNzaW9uVGltZUxpbWl0SG91cnMiOiAxMiwKICAgICJzdGFydGluZ0NhcmRMb2Nrb3V0RHVyYXRpb25TZWNvbmRzIjogMTUKICB9LAogICJtYXJrVGhyZXNob2xkcyI6IHsKICAgICJkZWZpbml0ZSI6IDAuMjUsCiAgICAibWFyZ2luYWwiOiAwLjE3CiAgfSwKICAiY2VudHJhbFNjYW5BZGp1ZGljYXRpb25SZWFzb25zIjogW10sCiAgInByZWNpbmN0U2NhbkFkanVkaWNhdGlvblJlYXNvbnMiOiBbXQp9Cg==';

/**
 * MIME type of data/systemSettings.json.
 */
export const mimeType = 'application/json';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: 6de7a0d93148ddb9cabbd0b94ed5308b09e149dd011e4a6e0d9212c7e54a94cd
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'systemSettings.json');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/systemSettings.json, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: 6de7a0d93148ddb9cabbd0b94ed5308b09e149dd011e4a6e0d9212c7e54a94cd
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/systemSettings.json.
 *
 * SHA-256 hash of file data: 6de7a0d93148ddb9cabbd0b94ed5308b09e149dd011e4a6e0d9212c7e54a94cd
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/systemSettings.json.
 *
 * SHA-256 hash of file data: 6de7a0d93148ddb9cabbd0b94ed5308b09e149dd011e4a6e0d9212c7e54a94cd
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}