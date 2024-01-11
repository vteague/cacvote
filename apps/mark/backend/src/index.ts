import { Logger, LogSource, LogEventId } from '@votingworks/logging';
import { loadEnvVarsFromDotenvFiles } from '@votingworks/backend';
import * as server from './server';
import { MARK_WORKSPACE, PORT } from './globals';
import { createWorkspace, Workspace } from './util/workspace';

export type { Api } from './app';
export * from './types';

loadEnvVarsFromDotenvFiles();

const logger = new Logger(LogSource.VxMarkBackend);

async function resolveWorkspace(): Promise<Workspace> {
  const workspacePath = MARK_WORKSPACE;
  if (!workspacePath) {
    await logger.log(LogEventId.ScanServiceConfigurationMessage, 'system', {
      message:
        'workspace path could not be determined; pass a workspace or run with MARK_WORKSPACE',
      disposition: 'failure',
    });
    throw new Error(
      'workspace path could not be determined; pass a workspace or run with MARK_WORKSPACE'
    );
  }
  return createWorkspace(workspacePath);
}

async function main(): Promise<number> {
  const workspace = await resolveWorkspace();
  server.start({ port: PORT, logger, workspace });
  return 0;
}

if (require.main === module) {
  void main()
    .catch((error) => {
      void logger.log(LogEventId.ApplicationStartup, 'system', {
        message: `Error in starting VxMark backend: ${(error as Error).stack}`,
        disposition: 'failure',
      });
      return 1;
    })
    .then((code) => {
      process.exitCode = code;
    });
}
