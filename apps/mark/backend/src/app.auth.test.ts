import { DateTime } from 'luxon';
import { electionFamousNames2021Fixtures } from '@votingworks/fixtures';
import {
  DEFAULT_SYSTEM_SETTINGS,
  SystemSettings,
  TEST_JURISDICTION,
} from '@votingworks/types';

import { mockOf } from '@votingworks/test-utils';
import { configureApp, createApp } from '../test/app_helpers';

const jurisdiction = TEST_JURISDICTION;
const { electionDefinition } = electionFamousNames2021Fixtures;
const { electionHash } = electionDefinition;
const systemSettings: SystemSettings = {
  arePollWorkerCardPinsEnabled: true,
  inactiveSessionTimeLimitMinutes: 10,
  overallSessionTimeLimitHours: 1,
  numIncorrectPinAttemptsAllowedBeforeCardLockout: 3,
  startingCardLockoutDurationSeconds: 15,
};

beforeAll(() => {
  expect(systemSettings).not.toEqual(DEFAULT_SYSTEM_SETTINGS);
});

test('getAuthStatus', async () => {
  const { apiClient, mockAuth, mockUsb } = createApp();
  await configureApp(apiClient, mockAuth, mockUsb, systemSettings);
  mockOf(mockAuth.getAuthStatus).mockClear(); // Clear mock calls from configureApp

  await apiClient.getAuthStatus();
  expect(mockAuth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(mockAuth.getAuthStatus).toHaveBeenNthCalledWith(1, {
    ...systemSettings,
    electionHash,
    jurisdiction,
  });
});

test('checkPin', async () => {
  const { apiClient, mockAuth, mockUsb } = createApp();
  await configureApp(apiClient, mockAuth, mockUsb, systemSettings);

  await apiClient.checkPin({ pin: '123456' });
  expect(mockAuth.checkPin).toHaveBeenCalledTimes(1);
  expect(mockAuth.checkPin).toHaveBeenNthCalledWith(
    1,
    { ...systemSettings, electionHash, jurisdiction },
    { pin: '123456' }
  );
});

test('logOut', async () => {
  const { apiClient, mockAuth, mockUsb } = createApp();
  await configureApp(apiClient, mockAuth, mockUsb, systemSettings);

  await apiClient.logOut();
  expect(mockAuth.logOut).toHaveBeenCalledTimes(1);
  expect(mockAuth.logOut).toHaveBeenNthCalledWith(1, {
    ...systemSettings,
    electionHash,
    jurisdiction,
  });
});

test('updateSessionExpiry', async () => {
  const { apiClient, mockAuth, mockUsb } = createApp();
  await configureApp(apiClient, mockAuth, mockUsb, systemSettings);

  await apiClient.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(mockAuth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(mockAuth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    { ...systemSettings, electionHash, jurisdiction },
    { sessionExpiresAt: expect.any(Date) }
  );
});

test('startCardlessVoterSession', async () => {
  const { apiClient, mockAuth, mockUsb } = createApp();
  await configureApp(apiClient, mockAuth, mockUsb, systemSettings);

  await apiClient.startCardlessVoterSession({
    ballotStyleId: 'b1',
    precinctId: 'p1',
  });
  expect(mockAuth.startCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.startCardlessVoterSession).toHaveBeenNthCalledWith(
    1,
    { ...systemSettings, electionHash, jurisdiction },
    { ballotStyleId: 'b1', precinctId: 'p1' }
  );
});

test('endCardlessVoterSession', async () => {
  const { apiClient, mockAuth, mockUsb } = createApp();
  await configureApp(apiClient, mockAuth, mockUsb, systemSettings);

  await apiClient.endCardlessVoterSession();
  expect(mockAuth.endCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.endCardlessVoterSession).toHaveBeenNthCalledWith(1, {
    ...systemSettings,
    electionHash,
    jurisdiction,
  });
});

test('getAuthStatus before election definition has been configured', async () => {
  const { apiClient, mockAuth } = createApp();

  await apiClient.getAuthStatus();
  expect(mockAuth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(mockAuth.getAuthStatus).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS
  );
});

test('checkPin before election definition has been configured', async () => {
  const { apiClient, mockAuth } = createApp();

  await apiClient.checkPin({ pin: '123456' });
  expect(mockAuth.checkPin).toHaveBeenCalledTimes(1);
  expect(mockAuth.checkPin).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS,
    { pin: '123456' }
  );
});

test('logOut before election definition has been configured', async () => {
  const { apiClient, mockAuth } = createApp();

  await apiClient.logOut();
  expect(mockAuth.logOut).toHaveBeenCalledTimes(1);
  expect(mockAuth.logOut).toHaveBeenNthCalledWith(1, DEFAULT_SYSTEM_SETTINGS);
});

test('updateSessionExpiry before election definition has been configured', async () => {
  const { apiClient, mockAuth } = createApp();

  await apiClient.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(mockAuth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(mockAuth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS,
    { sessionExpiresAt: expect.any(Date) }
  );
});

test('startCardlessVoterSession before election definition has been configured', async () => {
  const { apiClient, mockAuth } = createApp();

  await apiClient.startCardlessVoterSession({
    ballotStyleId: 'b1',
    precinctId: 'p1',
  });
  expect(mockAuth.startCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.startCardlessVoterSession).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS,
    { ballotStyleId: 'b1', precinctId: 'p1' }
  );
});

test('endCardlessVoterSession before election definition has been configured', async () => {
  const { apiClient, mockAuth } = createApp();

  await apiClient.endCardlessVoterSession();
  expect(mockAuth.endCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.endCardlessVoterSession).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS
  );
});
