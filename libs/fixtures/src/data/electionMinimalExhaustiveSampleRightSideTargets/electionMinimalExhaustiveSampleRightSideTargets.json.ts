/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'buffer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';
import { safeParseElectionDefinition } from '@votingworks/types';

/**
 * Data of data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json encoded as base64.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
const resourceDataBase64 = 'ewogICJ0aXRsZSI6ICJFeGFtcGxlIFByaW1hcnkgRWxlY3Rpb24iLAogICJzdGF0ZSI6ICJTdGF0ZSBvZiBTYW1wbGUiLAogICJjb3VudHkiOiB7CiAgICAiaWQiOiAic2FtcGxlLWNvdW50eSIsCiAgICAibmFtZSI6ICJTYW1wbGUgQ291bnR5IgogIH0sCiAgImRhdGUiOiAiMjAyMS0wOS0wOFQwMDowMDowMC0wODowMCIsCiAgImJhbGxvdExheW91dCI6IHsKICAgICJwYXBlclNpemUiOiAibGV0dGVyIiwKICAgICJ0YXJnZXRNYXJrUG9zaXRpb24iOiAicmlnaHQiCiAgfSwKICAiZGlzdHJpY3RzIjogWwogICAgewogICAgICAiaWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJuYW1lIjogIkRpc3RyaWN0IDEiCiAgICB9CiAgXSwKICAicGFydGllcyI6IFsKICAgIHsKICAgICAgImlkIjogIjAiLAogICAgICAibmFtZSI6ICJNYW1tYWwiLAogICAgICAiZnVsbE5hbWUiOiAiTWFtbWFsIFBhcnR5IiwKICAgICAgImFiYnJldiI6ICJNYSIKICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICIxIiwKICAgICAgIm5hbWUiOiAiRmlzaCIsCiAgICAgICJmdWxsTmFtZSI6ICJGaXNoIFBhcnR5IiwKICAgICAgImFiYnJldiI6ICJGIgogICAgfQogIF0sCiAgImNvbnRlc3RzIjogWwogICAgewogICAgICAiaWQiOiAiYmVzdC1hbmltYWwtbWFtbWFsIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJCZXN0IEFuaW1hbCIsCiAgICAgICJzZWF0cyI6IDEsCiAgICAgICJwYXJ0eUlkIjogIjAiLAogICAgICAiY2FuZGlkYXRlcyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiaG9yc2UiLAogICAgICAgICAgIm5hbWUiOiAiSG9yc2UiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJvdHRlciIsCiAgICAgICAgICAibmFtZSI6ICJPdHRlciIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjAiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImZveCIsCiAgICAgICAgICAibmFtZSI6ICJGb3giLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9CiAgICAgIF0sCiAgICAgICJhbGxvd1dyaXRlSW5zIjogZmFsc2UKICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICJiZXN0LWFuaW1hbC1maXNoIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJCZXN0IEFuaW1hbCIsCiAgICAgICJzZWF0cyI6IDEsCiAgICAgICJwYXJ0eUlkIjogIjEiLAogICAgICAiY2FuZGlkYXRlcyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAic2VhaG9yc2UiLAogICAgICAgICAgIm5hbWUiOiAiU2VhaG9yc2UiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJzYWxtb24iLAogICAgICAgICAgIm5hbWUiOiAiU2FsbW9uIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMSJdCiAgICAgICAgfQogICAgICBdLAogICAgICAiYWxsb3dXcml0ZUlucyI6IGZhbHNlCiAgICB9LAogICAgewogICAgICAiaWQiOiAiem9vLWNvdW5jaWwtbWFtbWFsIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJab28gQ291bmNpbCIsCiAgICAgICJzZWF0cyI6IDMsCiAgICAgICJwYXJ0eUlkIjogIjAiLAogICAgICAiY2FuZGlkYXRlcyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiemVicmEiLAogICAgICAgICAgIm5hbWUiOiAiWmVicmEiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJsaW9uIiwKICAgICAgICAgICJuYW1lIjogIkxpb24iLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJrYW5nYXJvbyIsCiAgICAgICAgICAibmFtZSI6ICJLYW5nYXJvbyIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjAiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImVsZXBoYW50IiwKICAgICAgICAgICJuYW1lIjogIkVsZXBoYW50IiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMCJdCiAgICAgICAgfQogICAgICBdLAogICAgICAiYWxsb3dXcml0ZUlucyI6IHRydWUKICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICJhcXVhcml1bS1jb3VuY2lsLWZpc2giLAogICAgICAiZGlzdHJpY3RJZCI6ICJkaXN0cmljdC0xIiwKICAgICAgInR5cGUiOiAiY2FuZGlkYXRlIiwKICAgICAgInRpdGxlIjogIlpvbyBDb3VuY2lsIiwKICAgICAgInNlYXRzIjogMiwKICAgICAgInBhcnR5SWQiOiAiMSIsCiAgICAgICJjYW5kaWRhdGVzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJtYW50YS1yYXkiLAogICAgICAgICAgIm5hbWUiOiAiTWFudGEgUmF5IiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMSJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAicHVmZmVyZmlzaCIsCiAgICAgICAgICAibmFtZSI6ICJQdWZmZXJmaXNoIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMSJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAicm9ja2Zpc2giLAogICAgICAgICAgIm5hbWUiOiAiUm9ja2Zpc2giLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJ0cmlnZ2VyZmlzaCIsCiAgICAgICAgICAibmFtZSI6ICJUcmlnZ2VyZmlzaCIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjEiXQogICAgICAgIH0KICAgICAgXSwKICAgICAgImFsbG93V3JpdGVJbnMiOiB0cnVlCiAgICB9LAogICAgewogICAgICAiaWQiOiAibmV3LXpvby1laXRoZXItbmVpdGhlciIsCiAgICAgICJkaXN0cmljdElkIjogImRpc3RyaWN0LTEiLAogICAgICAidHlwZSI6ICJtcy1laXRoZXItbmVpdGhlciIsCiAgICAgICJ0aXRsZSI6ICJCYWxsb3QgTWVhc3VyZSAxIiwKICAgICAgInBhcnR5SWQiOiAiMCIsCiAgICAgICJlaXRoZXJOZWl0aGVyQ29udGVzdElkIjogIm5ldy16b28tZWl0aGVyIiwKICAgICAgInBpY2tPbmVDb250ZXN0SWQiOiAibmV3LXpvby1waWNrIiwKICAgICAgImRlc2NyaXB0aW9uIjogIkluaXRpYXRpdmUgTWVhc3VyZSBOby4gMTIsIFNob3VsZCBTYW1wbGUgQ2l0eSBlc3RhYmxpc2ggYSBuZXcgc2FmYXJpLXN0eWxlIHpvbyBjb3N0aW5nIDIsMDAwLDAwMD9cblxuIEFsdGVybmF0aXZlIE1lYXN1cmUgMTIgQSwgU2hvdWxkIFNhbXBsZSBDaXR5IGVzdGFibGlzaCBhIG5ldyB0cmFkaXRpb25hbCB6b28gY29zdGluZyAxLDAwMCwwMDA/IiwKICAgICAgImVpdGhlck5laXRoZXJMYWJlbCI6ICJWT1RFIEZPUiBBUFBST1ZBTCBPRiBFSVRIRVIsIE9SIEFHQUlOU1QgQk9USCIsCiAgICAgICJwaWNrT25lTGFiZWwiOiAiQU5EIFZPVEUgRk9SIE9ORSIsCiAgICAgICJlaXRoZXJPcHRpb24iOiB7CiAgICAgICAgImlkIjogIm5ldy16b28tZWl0aGVyLWFwcHJvdmVkIiwKICAgICAgICAibGFiZWwiOiAiRk9SIEFQUFJPVkFMIE9GIEVJVEhFUiBJbml0aWF0aXZlIE5vLiAxMiBPUiBBbHRlcm5hdGl2ZSBJbml0aWF0aXZlIE5vLiAxMiBBIgogICAgICB9LAogICAgICAibmVpdGhlck9wdGlvbiI6IHsKICAgICAgICAiaWQiOiAibmV3LXpvby1uZWl0aGVyLWFwcHJvdmVkIiwKICAgICAgICAibGFiZWwiOiAiQUdBSU5TVCBCT1RIIEluaXRpYXRpdmUgTm8uIDEyIEFORCBBbHRlcm5hdGl2ZSBNZWFzdXJlIDEyIEEiCiAgICAgIH0sCiAgICAgICJmaXJzdE9wdGlvbiI6IHsKICAgICAgICAiaWQiOiAibmV3LXpvby1zYWZhcmkiLAogICAgICAgICJsYWJlbCI6ICJGT1IgSW5pdGlhdGl2ZSBOby4gMTIiCiAgICAgIH0sCiAgICAgICJzZWNvbmRPcHRpb24iOiB7CiAgICAgICAgImlkIjogIm5ldy16b28tdHJhZGl0aW9uYWwiLAogICAgICAgICJsYWJlbCI6ICJGT1IgQWx0ZXJuYXRpdmUgTWVhc3VyZSBOby4gMTIgQSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgImlkIjogImZpc2hpbmciLAogICAgICAiZGlzdHJpY3RJZCI6ICJkaXN0cmljdC0xIiwKICAgICAgInR5cGUiOiAieWVzbm8iLAogICAgICAidGl0bGUiOiAiQmFsbG90IE1lYXN1cmUgMyIsCiAgICAgICJwYXJ0eUlkIjogIjEiLAogICAgICAiZGVzY3JpcHRpb24iOiAiU2hvdWxkIGZpc2hpbmcgYmUgYmFubmVkIGluIGFsbCBjaXR5IG93bmVkIGxha2VzIGFuZCByaXZlcnM/IiwKICAgICAgInllc09wdGlvbiI6IHsKICAgICAgICAiaWQiOiAiYmFuLWZpc2hpbmciLAogICAgICAgICJsYWJlbCI6ICJZRVMiCiAgICAgIH0sCiAgICAgICJub09wdGlvbiI6IHsKICAgICAgICAiaWQiOiAiYWxsb3ctZmlzaGluZyIsCiAgICAgICAgImxhYmVsIjogIk5PIgogICAgICB9CiAgICB9CiAgXSwKICAicHJlY2luY3RzIjogWwogICAgewogICAgICAiaWQiOiAicHJlY2luY3QtMSIsCiAgICAgICJuYW1lIjogIlByZWNpbmN0IDEiCiAgICB9LAogICAgewogICAgICAiaWQiOiAicHJlY2luY3QtMiIsCiAgICAgICJuYW1lIjogIlByZWNpbmN0IDIiCiAgICB9CiAgXSwKICAiYmFsbG90U3R5bGVzIjogWwogICAgewogICAgICAiaWQiOiAiMU0iLAogICAgICAicHJlY2luY3RzIjogWyJwcmVjaW5jdC0xIiwgInByZWNpbmN0LTIiXSwKICAgICAgImRpc3RyaWN0cyI6IFsiZGlzdHJpY3QtMSJdLAogICAgICAicGFydHlJZCI6ICIwIgogICAgfSwKICAgIHsKICAgICAgImlkIjogIjJGIiwKICAgICAgInByZWNpbmN0cyI6IFsicHJlY2luY3QtMSIsICJwcmVjaW5jdC0yIl0sCiAgICAgICJkaXN0cmljdHMiOiBbImRpc3RyaWN0LTEiXSwKICAgICAgInBhcnR5SWQiOiAiMSIKICAgIH0KICBdLAogICJzZWFsVXJsIjogIi9zZWFscy9TYW1wbGUtU2VhbC5zdmciCn0K';

/**
 * MIME type of data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json.
 */
export const mimeType = 'application/json';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'electionMinimalExhaustiveSampleRightSideTargets.json');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}

/**
 * Full election definition for data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
export const electionDefinition = safeParseElectionDefinition(
  asText()
).unsafeUnwrap();

/**
 * Election definition for data/electionMinimalExhaustiveSampleRightSideTargets/electionMinimalExhaustiveSampleRightSideTargets.json.
 *
 * SHA-256 hash of file data: 3a53745921388c8bc10c6ee28471d16024f5ed1a74c0629dc82b7ab0085bea8c
 */
export const election = electionDefinition.election;