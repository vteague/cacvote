import { zipFile } from '@votingworks/test-utils';
import { electionGridLayoutNewHampshireAmherstFixtures } from '@votingworks/fixtures';
import { assertDefined, typedAs } from '@votingworks/basics';
import {
  BallotPackage,
  BallotPackageFileName,
  DEFAULT_SYSTEM_SETTINGS,
  LanguageCode,
  SystemSettings,
  UiStringsPackage,
  safeParseElectionDefinition,
  testCdfBallotDefinition,
} from '@votingworks/types';
import { readBallotPackageFromFile } from './ballot_package';
import { extractCdfUiStrings } from './extract_cdf_ui_strings';

test('readBallotPackageFromFile reads a ballot package without system settings from a file', async () => {
  const pkg = await zipFile({
    [BallotPackageFileName.ELECTION]:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
  });
  expect(
    await readBallotPackageFromFile(
      new File([pkg], 'election-ballot-package.zip')
    )
  ).toEqual(
    typedAs<BallotPackage>({
      electionDefinition:
        electionGridLayoutNewHampshireAmherstFixtures.electionDefinition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      uiStrings: {},
    })
  );
});

test('readBallotPackageFromFile reads a ballot package with system settings from a file', async () => {
  const pkg = await zipFile({
    [BallotPackageFileName.ELECTION]:
      electionGridLayoutNewHampshireAmherstFixtures.electionDefinition
        .electionData,
    [BallotPackageFileName.SYSTEM_SETTINGS]: JSON.stringify(
      typedAs<SystemSettings>(DEFAULT_SYSTEM_SETTINGS)
    ),
  });
  expect(
    await readBallotPackageFromFile(
      new File([pkg], 'election-ballot-package.zip')
    )
  ).toEqual(
    typedAs<BallotPackage>({
      electionDefinition:
        electionGridLayoutNewHampshireAmherstFixtures.electionDefinition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      uiStrings: {},
    })
  );
});

test('readBallotPackageFromFile loads available ui strings', async () => {
  const appStrings: UiStringsPackage = {
    [LanguageCode.ENGLISH]: {
      foo: 'bar',
      deeply: { nested: 'value' },
    },
    [LanguageCode.CHINESE]: {
      foo: 'bar_zh',
      deeply: { nested: 'value_zh' },
    },
  };

  const testCdfElectionData = JSON.stringify(testCdfBallotDefinition);

  const pkg = await zipFile({
    [BallotPackageFileName.ELECTION]: testCdfElectionData,
    [BallotPackageFileName.APP_STRINGS]: JSON.stringify(appStrings),
  });

  const expectedElectionStrings = extractCdfUiStrings(testCdfBallotDefinition);
  const expectedUiStrings: UiStringsPackage = {
    [LanguageCode.ENGLISH]: {
      ...assertDefined(appStrings[LanguageCode.ENGLISH]),
      ...assertDefined(expectedElectionStrings[LanguageCode.ENGLISH]),
    },
    [LanguageCode.CHINESE]: {
      ...assertDefined(appStrings[LanguageCode.CHINESE]),
    },
  };

  expect(
    await readBallotPackageFromFile(
      new File([pkg], 'election-ballot-package.zip')
    )
  ).toEqual<BallotPackage>({
    electionDefinition:
      safeParseElectionDefinition(testCdfElectionData).unsafeUnwrap(),
    systemSettings: DEFAULT_SYSTEM_SETTINGS,
    uiStrings: expectedUiStrings,
  });
});

test('readBallotPackageFromFile throws when an election.json is not present', async () => {
  const pkg = await zipFile({});
  await expect(
    readBallotPackageFromFile(new File([pkg], 'election-ballot-package.zip'))
  ).rejects.toThrowError(
    "ballot package does not have a file called 'election.json'"
  );
});

test('readBallotPackageFromFile throws when given an invalid zip file', async () => {
  await expect(
    readBallotPackageFromFile(
      new File(['not-a-zip'], 'election-ballot-package.zip')
    )
  ).rejects.toThrowError();
});

test('readBallotPackageFromFile throws when the file cannot be read', async () => {
  await expect(
    readBallotPackageFromFile({} as unknown as File)
  ).rejects.toThrowError();
});
