import * as grout from '@votingworks/grout';
import { UsbDrive } from '@votingworks/usb-drive';
import * as fs from 'fs/promises';
import { copy as copyDirectory } from 'fs-extra';
import { join } from 'path';
import { err, ok } from '@votingworks/basics';

import { Result } from '@votingworks/basics';

/** type of return value from exporting logs */
export type LogsResultType = Result<
  void,
  'no-logs-directory' | 'no-usb-drive' | 'copy-failed'
>;

const LOG_DIR = '/var/log/votingworks';

function buildApi({
  usbDrive,
  machineId,
}: {
  usbDrive: UsbDrive;
  machineId: string;
}) {
  return grout.createApi({
    async exportLogsToUsb(): Promise<LogsResultType> {
      let logDirPathExistsAndIsDirectory = false;
      try {
        const sourceStatus = await fs.stat(LOG_DIR);
        logDirPathExistsAndIsDirectory = sourceStatus.isDirectory();
      } catch (e) {
        // eslint-disable-line no-empty
      }

      if (!logDirPathExistsAndIsDirectory) {
        return err('no-logs-directory');
      }

      const status = await usbDrive.status();
      if (status.status !== 'mounted') {
        return err('no-usb-drive');
      }

      const mountpoint = status.mountPoint;
      const dateString = new Date().toISOString().replaceAll(':', '-');
      const dirPath = `/logs/machine_${machineId}/${dateString}`;
      const destinationDirectory = join(mountpoint, dirPath);

      try {
        await copyDirectory(LOG_DIR, destinationDirectory);
      } catch {
        return err('copy-failed');
      }

      return ok();
    },
  });
}

/** Grout API definition for UI string functions */
export type LogsApi = ReturnType<typeof buildApi>;

/** Creates a shareable implementation of {@link LogsApi}. */
export function createLogsApi({
  usbDrive,
  machineId,
}: {
  usbDrive: UsbDrive;
  machineId: string;
}): LogsApi {
  return buildApi({ usbDrive, machineId });
}
