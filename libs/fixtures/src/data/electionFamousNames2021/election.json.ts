/* Generated by res-to-ts. DO NOT EDIT */
/* eslint-disable */
/* istanbul ignore file */

import { Buffer } from 'buffer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep } from 'path';
import { BallotPackage, safeParseElectionDefinition, DEFAULT_SYSTEM_SETTINGS } from '@votingworks/types';

/**
 * Data of data/electionFamousNames2021/election.json encoded as base64.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
const resourceDataBase64 = 'ewogICJ0aXRsZSI6ICJMaW5jb2xuIE11bmljaXBhbCBHZW5lcmFsIEVsZWN0aW9uIiwKICAic3RhdGUiOiAiU3RhdGUgb2YgSGFtaWx0b24iLAogICJjb3VudHkiOiB7CiAgICAiaWQiOiAiZnJhbmtsaW4iLAogICAgIm5hbWUiOiAiRnJhbmtsaW4gQ291bnR5IgogIH0sCiAgImRhdGUiOiAiMjAyMS0wNi0wNlQwMDowMDowMC0xMDowMCIsCiAgInBhcnRpZXMiOiBbCiAgICB7CiAgICAgICJpZCI6ICIwIiwKICAgICAgIm5hbWUiOiAiRGVtb2NyYXQiLAogICAgICAiZnVsbE5hbWUiOiAiRGVtb2NyYXRpYyBQYXJ0eSIsCiAgICAgICJhYmJyZXYiOiAiRCIKICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICIxIiwKICAgICAgIm5hbWUiOiAiUmVwdWJsaWNhbiIsCiAgICAgICJmdWxsTmFtZSI6ICJSZXB1YmxpY2FuIFBhcnR5IiwKICAgICAgImFiYnJldiI6ICJSIgogICAgfSwKICAgIHsKICAgICAgImlkIjogIjIiLAogICAgICAibmFtZSI6ICJMaWJlcnR5IiwKICAgICAgImZ1bGxOYW1lIjogIkxpYmVydHkgUGFydHkiLAogICAgICAiYWJicmV2IjogIkxpIgogICAgfSwKICAgIHsKICAgICAgImlkIjogIjMiLAogICAgICAibmFtZSI6ICJHcmVlbiIsCiAgICAgICJmdWxsTmFtZSI6ICJHcmVlbiBQYXJ0eSIsCiAgICAgICJhYmJyZXYiOiAiRyIKICAgIH0KICBdLAogICJjb250ZXN0cyI6IFsKICAgIHsKICAgICAgImlkIjogIm1heW9yIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJNYXlvciIsCiAgICAgICJzZWF0cyI6IDEsCiAgICAgICJhbGxvd1dyaXRlSW5zIjogdHJ1ZSwKICAgICAgImNhbmRpZGF0ZXMiOiBbCiAgICAgICAgewogICAgICAgICAgImlkIjogInNoZXJsb2NrLWhvbG1lcyIsCiAgICAgICAgICAibmFtZSI6ICJTaGVybG9jayBIb2xtZXMiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJ0aG9tYXMtZWRpc29uIiwKICAgICAgICAgICJuYW1lIjogIlRob21hcyBFZGlzb24iLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9CiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICJjb250cm9sbGVyIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJDb250cm9sbGVyIiwKICAgICAgInNlYXRzIjogMSwKICAgICAgImFsbG93V3JpdGVJbnMiOiB0cnVlLAogICAgICAiY2FuZGlkYXRlcyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAid2luc3Rvbi1jaHVyY2hpbGwiLAogICAgICAgICAgIm5hbWUiOiAiV2luc3RvbiBDaHVyY2hpbGwiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJvcHJhaC13aW5mcmV5IiwKICAgICAgICAgICJuYW1lIjogIk9wcmFoIFdpbmZyZXkiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJsb3Vpcy1hcm1zdHJvbmciLAogICAgICAgICAgIm5hbWUiOiAiTG91aXMgQXJtc3Ryb25nIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMyJdCiAgICAgICAgfQogICAgICBdCiAgICB9LAogICAgewogICAgICAiaWQiOiAiYXR0b3JuZXkiLAogICAgICAiZGlzdHJpY3RJZCI6ICJkaXN0cmljdC0xIiwKICAgICAgInR5cGUiOiAiY2FuZGlkYXRlIiwKICAgICAgInRpdGxlIjogIkF0dG9ybmV5IiwKICAgICAgInNlYXRzIjogMSwKICAgICAgImFsbG93V3JpdGVJbnMiOiB0cnVlLAogICAgICAiY2FuZGlkYXRlcyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiam9obi1zbm93IiwKICAgICAgICAgICJuYW1lIjogIkpvaG4gU25vdyIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjEiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogIm1hcmstdHdhaW4iLAogICAgICAgICAgIm5hbWUiOiAiTWFyayBUd2FpbiIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjMiXQogICAgICAgIH0KICAgICAgXQogICAgfSwKICAgIHsKICAgICAgImlkIjogInB1YmxpYy13b3Jrcy1kaXJlY3RvciIsCiAgICAgICJkaXN0cmljdElkIjogImRpc3RyaWN0LTEiLAogICAgICAidHlwZSI6ICJjYW5kaWRhdGUiLAogICAgICAidGl0bGUiOiAiUHVibGljIFdvcmtzIERpcmVjdG9yIiwKICAgICAgInNlYXRzIjogMSwKICAgICAgImFsbG93V3JpdGVJbnMiOiB0cnVlLAogICAgICAiY2FuZGlkYXRlcyI6IFsKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiYmVuamFtaW4tZnJhbmtsaW4iLAogICAgICAgICAgIm5hbWUiOiAiQmVuamFtaW4gRnJhbmtsaW4iLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJyb2JlcnQtZG93bmV5LWpyIiwKICAgICAgICAgICJuYW1lIjogIlJvYmVydCBEb3duZXkgSnIuIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMSJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAiYmlsbC1ueWUiLAogICAgICAgICAgIm5hbWUiOiAiQmlsbCBOeWUiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIzIl0KICAgICAgICB9CiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICJjaGllZi1vZi1wb2xpY2UiLAogICAgICAiZGlzdHJpY3RJZCI6ICJkaXN0cmljdC0xIiwKICAgICAgInR5cGUiOiAiY2FuZGlkYXRlIiwKICAgICAgInRpdGxlIjogIkNoaWVmIG9mIFBvbGljZSIsCiAgICAgICJzZWF0cyI6IDEsCiAgICAgICJhbGxvd1dyaXRlSW5zIjogdHJ1ZSwKICAgICAgImNhbmRpZGF0ZXMiOiBbCiAgICAgICAgewogICAgICAgICAgImlkIjogIm5hdGFsaWUtcG9ydG1hbiIsCiAgICAgICAgICAibmFtZSI6ICJOYXRhbGllIFBvcnRtYW4iLAogICAgICAgICAgInBhcnR5SWRzIjogWyIwIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJmcmFuay1zaW5hdHJhIiwKICAgICAgICAgICJuYW1lIjogIkZyYW5rIFNpbmF0cmEiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJhbmR5LXdhcmhvbCIsCiAgICAgICAgICAibmFtZSI6ICJBbmR5IFdhcmhvbCIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjMiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImFsZnJlZC1oaXRjaGNvY2siLAogICAgICAgICAgIm5hbWUiOiAiQWxmcmVkIEhpdGNoY29jayIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjMiXQogICAgICAgIH0KICAgICAgXQogICAgfSwKICAgIHsKICAgICAgImlkIjogInBhcmtzLWFuZC1yZWNyZWF0aW9uLWRpcmVjdG9yIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJQYXJrcyBhbmQgUmVjcmVhdGlvbiBEaXJlY3RvciIsCiAgICAgICJzZWF0cyI6IDEsCiAgICAgICJhbGxvd1dyaXRlSW5zIjogdHJ1ZSwKICAgICAgImNhbmRpZGF0ZXMiOiBbCiAgICAgICAgewogICAgICAgICAgImlkIjogImNoYXJsZXMtZGFyd2luIiwKICAgICAgICAgICJuYW1lIjogIkNoYXJsZXMgRGFyd2luIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMCJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAic3RlcGhlbi1oYXdraW5nIiwKICAgICAgICAgICJuYW1lIjogIlN0ZXBoZW4gSGF3a2luZyIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjEiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImpvaGFuLXNlYmFzdGlhbi1iYWNoIiwKICAgICAgICAgICJuYW1lIjogIkpvaGFubiBTZWJhc3RpYW4gQmFjaCIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjAiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImFsZXhhbmRlci1ncmFoYW0tYmVsbCIsCiAgICAgICAgICAibmFtZSI6ICJBbGV4YW5kZXIgR3JhaGFtIEJlbGwiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9CiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICJib2FyZC1vZi1hbGRlcm1hbiIsCiAgICAgICJkaXN0cmljdElkIjogImRpc3RyaWN0LTEiLAogICAgICAidHlwZSI6ICJjYW5kaWRhdGUiLAogICAgICAidGl0bGUiOiAiQm9hcmQgb2YgQWxkZXJtYW4iLAogICAgICAic2VhdHMiOiA0LAogICAgICAiYWxsb3dXcml0ZUlucyI6IHRydWUsCiAgICAgICJjYW5kaWRhdGVzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJoZWxlbi1rZWxsZXIiLAogICAgICAgICAgIm5hbWUiOiAiSGVsZW4gS2VsbGVyIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMCJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAic3RldmUtam9icyIsCiAgICAgICAgICAibmFtZSI6ICJTdGV2ZSBKb2JzIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMSJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAibmlrb2xhLXRlc2xhIiwKICAgICAgICAgICJuYW1lIjogIk5pa29sYSBUZXNsYSIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjAiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogInZpbmNlbnQtdmFuLWdvZ2giLAogICAgICAgICAgIm5hbWUiOiAiVmluY2VudCBWYW4gR29naCIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjEiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogInBhYmxvLXBpY2Fzc28iLAogICAgICAgICAgIm5hbWUiOiAiUGFibG8gUGljYXNzbyIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjEiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogIndvbGZnYW5nLWFtYWRldXMtbW96YXJ0IiwKICAgICAgICAgICJuYW1lIjogIldvbGZnYW5nIEFtYWRldXMgTW96YXJ0IiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMiJdCiAgICAgICAgfQogICAgICBdCiAgICB9LAogICAgewogICAgICAiaWQiOiAiY2l0eS1jb3VuY2lsIiwKICAgICAgImRpc3RyaWN0SWQiOiAiZGlzdHJpY3QtMSIsCiAgICAgICJ0eXBlIjogImNhbmRpZGF0ZSIsCiAgICAgICJ0aXRsZSI6ICJDaXR5IENvdW5jaWwiLAogICAgICAic2VhdHMiOiA0LAogICAgICAiYWxsb3dXcml0ZUlucyI6IHRydWUsCiAgICAgICJjYW5kaWRhdGVzIjogWwogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJtYXJpZS1jdXJpZSIsCiAgICAgICAgICAibmFtZSI6ICJNYXJpZSBDdXJpZSIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjAiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImluZGlhbmEtam9uZXMiLAogICAgICAgICAgIm5hbWUiOiAiSW5kaWFuYSBKb25lcyIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjEiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogIm1vbmEtbGlzYSIsCiAgICAgICAgICAibmFtZSI6ICJNb25hIExpc2EiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIzIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJqYWNraWUtY2hhbiIsCiAgICAgICAgICAibmFtZSI6ICJKYWNraWUgQ2hhbiIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjMiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogInRpbS1hbGxlbiIsCiAgICAgICAgICAibmFtZSI6ICJUaW0gQWxsZW4iLAogICAgICAgICAgInBhcnR5SWRzIjogWyIyIl0KICAgICAgICB9LAogICAgICAgIHsKICAgICAgICAgICJpZCI6ICJtYXJrLWFudG9ueSIsCiAgICAgICAgICAibmFtZSI6ICJNYXJrIEFudG9ueSIsCiAgICAgICAgICAicGFydHlJZHMiOiBbIjAiXQogICAgICAgIH0sCiAgICAgICAgewogICAgICAgICAgImlkIjogImhhcnJpZXQtdHVibWFuIiwKICAgICAgICAgICJuYW1lIjogIkhhcnJpZXQgVHVibWFuIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMSJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAibWFydGluLWx1dGhlci1raW5nIiwKICAgICAgICAgICJuYW1lIjogIkRyLiBNYXJ0aW4gTHV0aGVyIEtpbmcgSnIuIiwKICAgICAgICAgICJwYXJ0eUlkcyI6IFsiMCJdCiAgICAgICAgfSwKICAgICAgICB7CiAgICAgICAgICAiaWQiOiAibWFyaWx5bi1tb25yb2UiLAogICAgICAgICAgIm5hbWUiOiAiTWFyaWx5biBNb25yb2UiLAogICAgICAgICAgInBhcnR5SWRzIjogWyIxIl0KICAgICAgICB9CiAgICAgIF0KICAgIH0KICBdLAogICJkaXN0cmljdHMiOiBbCiAgICB7CiAgICAgICJpZCI6ICJkaXN0cmljdC0xIiwKICAgICAgIm5hbWUiOiAiQ2l0eSBvZiBMaW5jb2xuIgogICAgfQogIF0sCiAgInByZWNpbmN0cyI6IFsKICAgIHsKICAgICAgImlkIjogIjIzIiwKICAgICAgIm5hbWUiOiAiTm9ydGggTGluY29sbiIKICAgIH0sCiAgICB7CiAgICAgICJpZCI6ICIyMiIsCiAgICAgICJuYW1lIjogIlNvdXRoIExpbmNvbG4iCiAgICB9LAogICAgewogICAgICAiaWQiOiAiMjEiLAogICAgICAibmFtZSI6ICJFYXN0IExpbmNvbG4iCiAgICB9LAogICAgewogICAgICAiaWQiOiAiMjAiLAogICAgICAibmFtZSI6ICJXZXN0IExpbmNvbG4iCiAgICB9CiAgXSwKICAiYmFsbG90U3R5bGVzIjogWwogICAgewogICAgICAiaWQiOiAiMSIsCiAgICAgICJwcmVjaW5jdHMiOiBbIjIwIiwgIjIxIiwgIjIyIiwgIjIzIl0sCiAgICAgICJkaXN0cmljdHMiOiBbImRpc3RyaWN0LTEiXQogICAgfQogIF0sCiAgInNlYWxVcmwiOiAiL3NlYWxzL3N0YXRlLW9mLWhhbWlsdG9uLW9mZmljaWFsLXNlYWwuc3ZnIiwKICAiYWRqdWRpY2F0aW9uUmVhc29ucyI6IFsKICAgICJVbmludGVycHJldGFibGVCYWxsb3QiLAogICAgIk92ZXJ2b3RlIiwKICAgICJVbmRlcnZvdGUiLAogICAgIkJsYW5rQmFsbG90IgogIF0KfQo=';

/**
 * MIME type of data/electionFamousNames2021/election.json.
 */
export const mimeType = 'application/json';

/**
 * Path to a file containing this file's contents.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export function asFilePath(): string {
  const directoryPath = mkdtempSync(tmpdir() + sep);
  const filePath = join(directoryPath, 'election.json');
  writeFileSync(filePath, asBuffer());
  return filePath;
}

/**
 * Convert to a `data:` URL of data/electionFamousNames2021/election.json, suitable for embedding in HTML.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export function asDataUrl(): string {
  return `data:${mimeType};base64,${resourceDataBase64}`;
}

/**
 * Raw data of data/electionFamousNames2021/election.json.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export function asBuffer(): Buffer {
  return Buffer.from(resourceDataBase64, 'base64');
}

/**
 * Text content of data/electionFamousNames2021/election.json.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export function asText(): string {
  return asBuffer().toString('utf-8');
}

/**
 * Full election definition for data/electionFamousNames2021/election.json.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export const electionDefinition = safeParseElectionDefinition(
  asText()
).unsafeUnwrap();

/**
 * Election definition for data/electionFamousNames2021/election.json.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export const election = electionDefinition.election;

/**
 * Ballot package for data/electionFamousNames2021/election.json.
 *
 * SHA-256 hash of file data: 95b894cd278da3775fbc01792fffcfbf622e24e8c0dc3fdf805f484f69d680a7
 */
export function toBallotPackage(systemSettings = DEFAULT_SYSTEM_SETTINGS): BallotPackage {
  return {
    electionDefinition,
    systemSettings,
  };
}