import { Application } from 'express';
import { Logger, fakeLogger } from '@votingworks/logging';
import { Server } from 'http';
import * as grout from '@votingworks/grout';
import { buildMockDippedSmartCardAuth } from '@votingworks/auth';
import { dirSync } from 'tmp';
import getPort from 'get-port';
import { MockUsbDrive, createMockUsbDrive } from '@votingworks/usb-drive';
import { Workspace, createWorkspace } from '../../src/util/workspace';
import { MockScanner, makeMockScanner } from '../util/mocks';
import { Importer } from '../../src/importer';
import { Api } from '../../src';
import { buildCentralScannerApp } from '../../src/app';
import { start } from '../../src/server';
import { Store } from '../../src/store';

export async function withApp(
  fn: (context: {
    auth: ReturnType<typeof buildMockDippedSmartCardAuth>;
    workspace: Workspace;
    scanner: MockScanner;
    mockUsbDrive: MockUsbDrive;
    importer: Importer;
    app: Application;
    logger: Logger;
    apiClient: grout.Client<Api>;
    server: Server;
    store: Store;
  }) => Promise<void>
): Promise<void> {
  const port = await getPort();
  const auth = buildMockDippedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name);
  const scanner = makeMockScanner();
  const importer = new Importer({ workspace, scanner });
  const mockUsbDrive = createMockUsbDrive();

  const logger = fakeLogger();
  const app = buildCentralScannerApp({
    auth,
    usbDrive: mockUsbDrive.usbDrive,
    allowedExportPatterns: ['/tmp/**'],
    importer,
    workspace,
    logger,
  });
  const baseUrl = `http://localhost:${port}/api`;
  const apiClient = grout.createClient({
    baseUrl,
  });
  const server = await start({
    app,
    logger,
    workspace,
    port,
  });

  try {
    await fn({
      auth,
      workspace,
      store: workspace.store,
      scanner,
      mockUsbDrive,
      importer,
      app,
      logger,
      apiClient,
      server,
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    workspace.reset();
  }
}
