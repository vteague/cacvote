/* eslint-disable max-classes-per-file */
import { MockFunction, mockFunction } from '@votingworks/test-utils';

import { Card, CardStatus } from '../src/card';
import {
  CardReader,
  OnReaderStatusChange,
  ReaderStatus,
} from '../src/card_reader';
import { CardType } from '../src/certs';
import { JavaCard } from '../src/java_card';

/**
 * Generates a numeric array of the specified length, where all values are the specified value
 */
export function numericArray(input: {
  length: number;
  value?: number;
}): number[] {
  return Array.from<number>({ length: input.length }).fill(input.value ?? 0);
}

/**
 * A mock card reader
 */
export class MockCardReader implements Pick<CardReader, 'transmit'> {
  private readonly onReaderStatusChange: OnReaderStatusChange;

  constructor(input: ConstructorParameters<typeof CardReader>[0]) {
    this.onReaderStatusChange = input.onReaderStatusChange;
  }
  setReaderStatus(readerStatus: ReaderStatus): void {
    this.onReaderStatusChange(readerStatus);
  }

  // eslint-disable-next-line vx/gts-no-public-class-fields
  transmit: MockFunction<CardReader['transmit']> =
    mockFunction<CardReader['transmit']>('transmit');
}

/**
 * The card API with all methods mocked using our custom libs/test-utils mocks
 */
export interface MockCard {
  getCardStatus: MockFunction<Card['getCardStatus']>;
  checkPin: MockFunction<Card['checkPin']>;
  program: MockFunction<Card['program']>;
  readData: MockFunction<Card['readData']>;
  writeData: MockFunction<Card['writeData']>;
  clearData: MockFunction<Card['clearData']>;
  unprogram: MockFunction<Card['unprogram']>;
}

/**
 * Builds a mock card instance
 */
export function buildMockCard(): MockCard {
  return {
    getCardStatus: mockFunction<Card['getCardStatus']>('getCardStatus'),
    checkPin: mockFunction<Card['checkPin']>('checkPin'),
    program: mockFunction<Card['program']>('program'),
    readData: mockFunction<Card['readData']>('readData'),
    writeData: mockFunction<Card['writeData']>('writeData'),
    clearData: mockFunction<Card['clearData']>('clearData'),
    unprogram: mockFunction<Card['unprogram']>('unprogram'),
  };
}

/**
 * Asserts that all the expected calls to all the methods of a mock card were made
 */
export function mockCardAssertComplete(mockCard: MockCard): void {
  for (const mockMethod of Object.values(mockCard) as Array<
    MockCard[keyof MockCard]
  >) {
    mockMethod.assertComplete();
  }
}

/**
 * An extension of the Java Card class with a method for manually setting the card status to
 * simplify setup for Java Card tests that require the card to be in a specific starting state
 */
export class TestJavaCard extends JavaCard {
  setCardStatus(cardStatus: CardStatus): void {
    this.cardStatus = cardStatus;
  }
}

/**
 * An identifier for a set of test files
 */
export type TestFileSetId = '1' | '2';

interface CardAgnosticTestFile {
  fileType:
    | 'vx-admin-cert-authority-cert.der'
    | 'vx-admin-cert-authority-cert.pem'
    | 'vx-admin-private-key.pem'
    | 'vx-central-scan-cert.pem'
    | 'vx-central-scan-private-key.pem'
    | 'vx-cert-authority-cert.pem'
    | 'vx-mark-cert.pem'
    | 'vx-mark-private-key.pem'
    | 'vx-private-key.pem'
    | 'vx-scan-cert.pem'
    | 'vx-scan-private-key.pem';
  setId?: TestFileSetId;
}

interface CardSpecificTestFile {
  fileType:
    | 'card-vx-admin-cert.der'
    | 'card-vx-admin-private-key.pem'
    | 'card-vx-admin-public-key.der'
    | 'card-vx-cert.der'
    | 'card-vx-private-key.pem'
    | 'card-vx-public-key.der';
  setId?: TestFileSetId;
  cardType: CardType;
}

type TestFile = CardAgnosticTestFile | CardSpecificTestFile;

function isCardSpecificTestFile(
  testFile: TestFile
): testFile is CardSpecificTestFile {
  return 'cardType' in testFile;
}

/**
 * Gets the file path of a test key or cert generated by ./scripts/generate-test-keys-and-certs
 */
export function getTestFilePath(testFile: TestFile): string {
  const setId: TestFileSetId = testFile.setId ?? '1';
  if (isCardSpecificTestFile(testFile)) {
    return `./certs/test/set-${setId}/${testFile.cardType}/${testFile.fileType}`;
  }
  return `./certs/test/set-${setId}/${testFile.fileType}`;
}
