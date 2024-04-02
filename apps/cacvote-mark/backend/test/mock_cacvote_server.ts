import { deferred } from '@votingworks/basics';
import { unsafeParse } from '@votingworks/types';
import app, { Application, Request, Response } from 'express';
import {
  IncomingMessage,
  RequestListener,
  Server,
  ServerResponse,
  createServer,
} from 'http';
import { AddressInfo } from 'net';
import { Client } from '../src/cacvote-server/client';
import {
  JournalEntry,
  SignedObject,
  Uuid,
  UuidSchema,
} from '../src/cacvote-server/types';

export interface MockCacvoteServer {
  inner: Server;
  client: Client;
  stop(): Promise<void>;
}

export async function mockCacvoteServer<
  Request extends typeof IncomingMessage,
  Response extends typeof ServerResponse,
>(handler: RequestListener<Request, Response>): Promise<MockCacvoteServer> {
  const listening = deferred<void>();
  const server = createServer(handler).listen(
    { host: '127.0.0.1', port: 0 },
    listening.resolve
  );
  await listening.promise;
  const address = server.address() as AddressInfo;
  const url = new URL(`http://127.0.0.1:${address.port}`);
  const client = new Client(url);
  return {
    inner: server,
    client,
    async stop() {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    },
  };
}

export class MockCacvoteAppBuilder {
  private journalEntries: JournalEntry[] = [];
  private readonly objects = new Map<Uuid, SignedObject>();
  private onGetJournalEntriesCallback: (res: Response) => void = () =>
    undefined;
  private onStatusCheckCallback: (res: Response) => void = () => undefined;
  private onPostObjectCallback: (req: Request, res: Response) => void = () =>
    undefined;
  private onGetObjectByIdCallback: (req: Request, res: Response) => void = () =>
    undefined;

  withJournalEntries(journalEntries: JournalEntry[]): this {
    this.journalEntries = journalEntries;
    return this;
  }

  withObject(object: SignedObject): this {
    this.objects.set(object.getId(), object);
    return this;
  }

  onGetJournalEntries(cb: (res: Response) => void): this {
    this.onGetJournalEntriesCallback = cb;
    return this;
  }

  onStatusCheck(cb: (res: Response) => void): this {
    this.onStatusCheckCallback = cb;
    return this;
  }

  onPostObject(cb: (req: Request, res: Response) => void): this {
    this.onPostObjectCallback = cb;
    return this;
  }

  onGetObjectById(cb: (req: Request, res: Response) => void): this {
    this.onGetObjectByIdCallback = cb;
    return this;
  }

  build(): Application {
    const server = app();

    server.get('/api/status', (_req, res) => {
      this.onStatusCheckCallback(res);

      if (res.headersSent) {
        return;
      }

      res.status(200).send('{}');
    });

    server.get('/api/journal-entries', (_req, res) => {
      this.onGetJournalEntriesCallback(res);

      if (res.headersSent) {
        return;
      }

      res.status(200).json(this.journalEntries);
    });

    server.post('/api/objects', (req, res) => {
      this.onPostObjectCallback(req, res);

      if (res.headersSent) {
        return;
      }

      res.status(201).end();
    });

    server.get('/api/objects/:id', (req, res) => {
      this.onGetObjectByIdCallback(req, res);

      if (res.headersSent) {
        return;
      }

      const id = unsafeParse(UuidSchema, req.params.id);
      const object = this.objects.get(id);
      if (object) {
        res.status(200).json(object);
      } else {
        res.status(404).end();
      }
    });

    return server;
  }
}
