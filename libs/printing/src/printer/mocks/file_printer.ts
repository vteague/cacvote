import { join } from 'path';
import { Buffer } from 'buffer';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { Optional, assert, iter } from '@votingworks/basics';
import { writeFile } from 'fs/promises';
import { PrintProps, Printer, PrinterConfig, PrinterStatus } from '../types';

export const MOCK_PRINTER_STATE_FILENAME = 'state.json';
export const MOCK_PRINTER_OUTPUT_DIRNAME = 'prints';
export const DEFAULT_MOCK_USB_DRIVE_DIR = '/tmp/mock-printer';
export const DEV_MOCK_PRINTER_DIR = join(__dirname, '../../../dev-workspace');

function getMockPrinterPath(): string {
  // istanbul ignore next
  if (process.env.NODE_ENV === 'development') {
    return DEV_MOCK_PRINTER_DIR;
  }

  return DEFAULT_MOCK_USB_DRIVE_DIR;
}

type MockStateFileContents = PrinterStatus;

function getMockPrinterStateFilePath(): string {
  return join(getMockPrinterPath(), MOCK_PRINTER_STATE_FILENAME);
}

function getMockPrinterOutputPath(): string {
  return join(getMockPrinterPath(), MOCK_PRINTER_OUTPUT_DIRNAME);
}

/**
 * Converts a MockFileContents object into a Buffer
 */
function serializeMockFileContents(
  mockStateFileContents: MockStateFileContents
): Buffer {
  return Buffer.from(JSON.stringify(mockStateFileContents), 'utf-8');
}

/**
 * Converts a Buffer created by serializeMockFileContents back into a MockFileContents object
 */
function deserializeMockFileContents(file: Buffer): MockStateFileContents {
  return JSON.parse(file.toString('utf-8'));
}

function writeToMockFile(mockStateFileContents: MockStateFileContents): void {
  mkdirSync(getMockPrinterPath(), { recursive: true });
  writeFileSync(
    getMockPrinterStateFilePath(),
    serializeMockFileContents(mockStateFileContents)
  );
  // Create the output directory whenever we write to the state file, so that
  // it's there before any prints are created
  mkdirSync(getMockPrinterOutputPath(), { recursive: true });
}

export function initializeMockFile(): void {
  writeToMockFile({
    connected: false,
  });
}

/**
 * A helper for readFromMockFile. Returns undefined if the mock file doesn't exist or can't be
 * parsed.
 */
function readFromMockFileHelper(): Optional<MockStateFileContents> {
  const mockFilePath = getMockPrinterStateFilePath();
  if (!existsSync(mockFilePath)) {
    return undefined;
  }
  const file = readFileSync(mockFilePath);
  try {
    return deserializeMockFileContents(file);
  } catch {
    /* istanbul ignore next */
    return undefined;
  }
}

/**
 * Reads and parses the contents of the file underlying a MockFileUsbDrive
 */
function readFromMockFile(): MockStateFileContents {
  let mockFileContents = readFromMockFileHelper();
  if (!mockFileContents) {
    initializeMockFile();
    mockFileContents = readFromMockFileHelper();
    assert(mockFileContents !== undefined);
  }
  return mockFileContents;
}

export class MockFilePrinter implements Printer {
  status(): Promise<PrinterStatus> {
    return Promise.resolve(readFromMockFile());
  }

  async print(props: PrintProps): Promise<void> {
    const status = readFromMockFile();
    if (!status.connected) {
      throw new Error('cannot print without printer connected');
    }

    const { data } = props;
    const filename = join(
      getMockPrinterOutputPath(),
      `print-job-${new Date().toISOString()}.pdf`
    );

    await writeFile(filename, data);
  }
}

interface MockFilePrinterHandler {
  connectPrinter: (config: PrinterConfig) => void;
  disconnectPrinter: () => void;
  getPrinterStatus(): PrinterStatus;
  getDataPath: () => string;
  getLastPrintPath: () => Optional<string>;
  cleanup: () => void;
}

export function getMockFilePrinterHandler(): MockFilePrinterHandler {
  return {
    connectPrinter: (config: PrinterConfig) => {
      writeToMockFile({
        connected: true,
        config,
      });
    },
    disconnectPrinter: () => {
      writeToMockFile({
        connected: false,
      });
    },
    getPrinterStatus: () => readFromMockFile(),
    getDataPath: getMockPrinterOutputPath,
    getLastPrintPath() {
      const printPaths = readdirSync(getMockPrinterOutputPath(), {
        withFileTypes: true,
      })
        .filter((dirent) => dirent.isFile())
        .map((file) => join(getMockPrinterOutputPath(), file.name));

      return iter(printPaths).maxBy((filePath) =>
        lstatSync(filePath).ctime.getTime()
      );
    },
    cleanup: () => {
      rmSync(getMockPrinterPath(), { recursive: true, force: true });
    },
  };
}
