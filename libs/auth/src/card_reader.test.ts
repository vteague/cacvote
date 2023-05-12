import { Buffer } from 'buffer';
import EventEmitter from 'events';
import pcscLite from 'pcsclite';
import { mockOf } from '@votingworks/test-utils';

import { numericArray } from '../test/utils';
import {
  CardCommand,
  GET_RESPONSE,
  MAX_APDU_LENGTH,
  MAX_COMMAND_APDU_DATA_LENGTH,
  MAX_RESPONSE_APDU_DATA_LENGTH,
  ResponseApduError,
  STATUS_WORD,
} from './apdu';
import { CardReader, PcscLite } from './card_reader';

type ConnectCallback = (error?: Error, protocol?: number) => void;
type Connect = (options: { share_mode: number }, cb: ConnectCallback) => void;
type DisconnectCallback = (error?: Error) => void;
type Disconnect = (db: DisconnectCallback) => void;
type TransmitCallback = (error?: Error, response?: Buffer) => void;
type Transmit = (
  data: Buffer,
  responseLength: number,
  protocol: number,
  cb: TransmitCallback
) => void;

// Because pcsclite doesn't export the reader type (and it can't easily be extracted from the types
// that are exported), create a type that covers the subset of the reader interface that we use
type PcscLiteReader = EventEmitter & {
  connect: Connect;
  disconnect: Disconnect;
  SCARD_SHARE_EXCLUSIVE: number;
  SCARD_STATE_PRESENT: number;
  transmit: Transmit;
};

function newMockPcscLiteReader(): PcscLiteReader {
  const additionalFields: Partial<PcscLiteReader> = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    SCARD_SHARE_EXCLUSIVE: 123,
    SCARD_STATE_PRESENT: 1, // A number that's easy to reason about bitwise-& with
    transmit: jest.fn(),
  };
  return Object.assign(new EventEmitter(), additionalFields) as PcscLiteReader;
}

jest.mock('pcsclite');

let mockPcscLite: PcscLite;
let mockPcscLiteReader: PcscLiteReader;
let onReaderStatusChange: jest.Mock;

beforeEach(() => {
  mockPcscLite = new EventEmitter() as PcscLite;
  mockOf(pcscLite).mockImplementation(() => mockPcscLite);
  mockPcscLiteReader = newMockPcscLiteReader();
  onReaderStatusChange = jest.fn();
});

const simpleCommand = {
  command: new CardCommand({ ins: 0x01, p1: 0x02, p2: 0x03 }),
  buffer: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00]),
} as const;
const commandWithLotsOfData = {
  command: new CardCommand({
    ins: 0x01,
    p1: 0x02,
    p2: 0x03,
    data: Buffer.from(
      numericArray({ length: MAX_COMMAND_APDU_DATA_LENGTH * 2 + 10 })
    ),
  }),
  buffers: [
    Buffer.from([
      0x10,
      0x01,
      0x02,
      0x03,
      MAX_COMMAND_APDU_DATA_LENGTH,
      ...numericArray({ length: MAX_COMMAND_APDU_DATA_LENGTH }),
    ]),
    Buffer.from([
      0x10,
      0x01,
      0x02,
      0x03,
      MAX_COMMAND_APDU_DATA_LENGTH,
      ...numericArray({ length: MAX_COMMAND_APDU_DATA_LENGTH }),
    ]),
    Buffer.from([
      0x00,
      0x01,
      0x02,
      0x03,
      0x0a, // 10 in hex
      ...numericArray({ length: 10 }),
    ]),
  ],
} as const;

const mockConnectProtocol = 0;
const mockConnectSuccess: Connect = (_options, cb) =>
  cb(undefined, mockConnectProtocol);
const mockConnectError: Connect = (_options, cb) => cb(new Error('Whoa!'));
function newMockTransmitSuccess(response: Buffer): Transmit {
  return (_data, _responseLength, _protocol, cb) => cb(undefined, response);
}
const mockTransmitError: Transmit = (_data, _responseLength, _protocol, cb) =>
  cb(new Error('Whoa!'));

function newCardReader(
  startingStatus: 'default' | 'ready' = 'default'
): CardReader {
  const cardReader = new CardReader({ onReaderStatusChange });
  if (startingStatus === 'ready') {
    mockPcscLite.emit('reader', mockPcscLiteReader);
    mockOf(mockPcscLiteReader.connect).mockImplementationOnce(
      mockConnectSuccess
    );
    mockPcscLiteReader.emit('status', { state: 1 });
    expect(onReaderStatusChange).toHaveBeenNthCalledWith(1, 'ready');
    onReaderStatusChange.mockClear();
  }
  return cardReader;
}

test('CardReader status changes', () => {
  newCardReader();

  mockPcscLite.emit('error');
  expect(onReaderStatusChange).toHaveBeenCalledTimes(1);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(1, 'unknown_error');

  mockPcscLite.emit('reader', mockPcscLiteReader);
  mockPcscLiteReader.emit('error');
  // Verify that onReaderStatusChange hasn't been called, since the status is still unknown_error
  expect(onReaderStatusChange).toHaveBeenCalledTimes(1);

  mockOf(mockPcscLiteReader.connect).mockImplementationOnce(mockConnectError);
  mockPcscLiteReader.emit('status', { state: 1 });
  expect(mockPcscLiteReader.connect).toHaveBeenCalledWith(
    { share_mode: mockPcscLiteReader.SCARD_SHARE_EXCLUSIVE },
    expect.anything()
  );
  expect(onReaderStatusChange).toHaveBeenCalledTimes(2);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(2, 'card_error');

  mockOf(mockPcscLiteReader.connect).mockImplementationOnce(mockConnectSuccess);
  mockPcscLiteReader.emit('status', { state: 1 });
  expect(mockPcscLiteReader.connect).toHaveBeenCalledWith(
    { share_mode: mockPcscLiteReader.SCARD_SHARE_EXCLUSIVE },
    expect.anything()
  );
  expect(onReaderStatusChange).toHaveBeenCalledTimes(3);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(3, 'ready');

  mockPcscLiteReader.emit('status', { state: 0 });
  expect(onReaderStatusChange).toHaveBeenCalledTimes(4);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(4, 'no_card');
  expect(mockPcscLiteReader.disconnect).toHaveBeenCalledTimes(1);

  mockPcscLiteReader.emit('error');
  expect(onReaderStatusChange).toHaveBeenCalledTimes(5);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(5, 'unknown_error');

  mockPcscLiteReader.emit('end');
  expect(onReaderStatusChange).toHaveBeenCalledTimes(6);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(6, 'no_card_reader');
});

test('CardReader command transmission - reader not ready', async () => {
  const cardReader = newCardReader();

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow(
    'Reader not ready'
  );
});

test('CardReader command transmission - success', async () => {
  const cardReader = newCardReader('ready');
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2])
    )
  );

  expect(await cardReader.transmit(simpleCommand.command)).toEqual(
    Buffer.from([])
  );

  expect(mockPcscLiteReader.transmit).toHaveBeenCalledTimes(1);
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    1,
    simpleCommand.buffer,
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
});

test('CardReader command transmission - response APDU with error status word', async () => {
  const cardReader = newCardReader('ready');
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([
        STATUS_WORD.FILE_NOT_FOUND.SW1,
        STATUS_WORD.FILE_NOT_FOUND.SW2,
      ])
    )
  );

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow(
    new ResponseApduError([
      STATUS_WORD.FILE_NOT_FOUND.SW1,
      STATUS_WORD.FILE_NOT_FOUND.SW2,
    ])
  );

  expect(mockPcscLiteReader.transmit).toHaveBeenCalledTimes(1);
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    1,
    simpleCommand.buffer,
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
});

test('CardReader command transmission - response APDU with no status word', async () => {
  const cardReader = newCardReader('ready');
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(Buffer.from([]))
  );

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow();

  expect(mockPcscLiteReader.transmit).toHaveBeenCalledTimes(1);
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    1,
    simpleCommand.buffer,
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
});

test('CardReader command transmission - chained command', async () => {
  const cardReader = newCardReader('ready');
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2])
    )
  );
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2])
    )
  );
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([0x00, STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2])
    )
  );

  expect(await cardReader.transmit(commandWithLotsOfData.command)).toEqual(
    Buffer.from([0x00])
  );

  expect(mockPcscLiteReader.transmit).toHaveBeenCalledTimes(3);
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    1,
    commandWithLotsOfData.buffers[0],
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    2,
    commandWithLotsOfData.buffers[1],
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    3,
    commandWithLotsOfData.buffers[2],
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
});

test('CardReader command transmission - chained response', async () => {
  const cardReader = newCardReader('ready');
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([
        ...numericArray({ length: MAX_RESPONSE_APDU_DATA_LENGTH, value: 1 }),
        STATUS_WORD.SUCCESS_MORE_DATA_AVAILABLE.SW1,
        10,
      ])
    )
  );
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(
    newMockTransmitSuccess(
      Buffer.from([
        ...numericArray({ length: 10, value: 2 }),
        STATUS_WORD.SUCCESS.SW1,
        STATUS_WORD.SUCCESS.SW2,
      ])
    )
  );

  expect(await cardReader.transmit(simpleCommand.command)).toEqual(
    Buffer.from([
      ...numericArray({ length: MAX_RESPONSE_APDU_DATA_LENGTH, value: 1 }),
      ...numericArray({ length: 10, value: 2 }),
    ])
  );

  expect(mockPcscLiteReader.transmit).toHaveBeenCalledTimes(2);
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    1,
    simpleCommand.buffer,
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    2,
    Buffer.from([
      0x00,
      GET_RESPONSE.INS,
      GET_RESPONSE.P1,
      GET_RESPONSE.P2,
      0x00,
    ]),
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
});

test('CardReader command transmission - transmit failure', async () => {
  const cardReader = newCardReader('ready');
  mockOf(mockPcscLiteReader.transmit).mockImplementationOnce(mockTransmitError);

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow(
    'Failed to transmit data to card'
  );

  expect(mockPcscLiteReader.transmit).toHaveBeenCalledTimes(1);
  expect(mockPcscLiteReader.transmit).toHaveBeenNthCalledWith(
    1,
    simpleCommand.buffer,
    MAX_APDU_LENGTH,
    mockConnectProtocol,
    expect.anything()
  );
});
