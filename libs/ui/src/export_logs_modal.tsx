import React, { useEffect, useState } from 'react';
import { join } from 'path';
import {
  generateLogFilename,
  LogFileType,
  isElectionManagerAuth,
  isSystemAdministratorAuth,
} from '@votingworks/utils';

import {
  LogEventId,
  LOGS_ROOT_LOCATION,
  LOG_NAME,
  FULL_LOG_PATH,
  Logger,
} from '@votingworks/logging';

import {
  DippedSmartCardAuth,
  ElectionDefinition,
  InsertedSmartCardAuth,
} from '@votingworks/types';
import { assert, sleep, throwIllegalValue } from '@votingworks/basics';
import type { UsbDriveStatus } from '@votingworks/usb-drive';
import { Button } from './button';
import { Modal } from './modal';

import { Loading } from './loading';
import { UsbImage } from './graphics';
import { Font, P } from './typography';

export interface ExportLogsModalProps {
  usbDriveStatus: UsbDriveStatus;
  auth: DippedSmartCardAuth.AuthStatus | InsertedSmartCardAuth.AuthStatus;
  logFileType: LogFileType;
  logger: Logger;
  electionDefinition?: ElectionDefinition;
  machineConfig: {
    machineId: string;
    codeVersion: string;
  };
  onClose: () => void;
}

enum ModalState {
  Error = 'error',
  Saving = 'saving',
  Done = 'done',
  Init = 'init',
}

export function ExportLogsModal({
  usbDriveStatus,
  auth,
  logFileType,
  logger,
  electionDefinition,
  machineConfig,
  onClose,
}: ExportLogsModalProps): JSX.Element {
  assert(isSystemAdministratorAuth(auth) || isElectionManagerAuth(auth)); // TODO(auth) should this check for a specific user type
  const userRole = auth.user.role;

  const [currentState, setCurrentState] = useState(ModalState.Init);
  const [errorMessage, setErrorMessage] = useState('');

  const [savedFilename, setSavedFilename] = useState('');
  const [foundLogFile, setFoundLogFile] = useState(false);
  const [isLocatingLogFile, setIsLocatingLogFile] = useState(true);

  useEffect(() => {
    async function checkLogFile() {
      if (window.kiosk) {
        const allLogs =
          await window.kiosk.getFileSystemEntries(LOGS_ROOT_LOCATION);
        const vxLogFile = allLogs.filter((f) => f.name === `${LOG_NAME}.log`);
        if (vxLogFile.length > 0) {
          setFoundLogFile(true);
          await logger.log(LogEventId.SaveLogFileFound, userRole, {
            disposition: 'success',
            message:
              'Successfully located vx-logs.log file on machine to save.',
          });
        } else {
          setFoundLogFile(false);
          await logger.log(LogEventId.SaveLogFileFound, userRole, {
            disposition: 'failure',
            message:
              'Could not locate vx-logs.log file on machine. Machine is not configured for production use.',
            result: 'Logs are not saveable.',
          });
        }
        setIsLocatingLogFile(false);
      }
    }
    void checkLogFile();
  }, [userRole, logger]);
  const defaultFilename = generateLogFilename('vx-logs', logFileType);

  async function exportLogs(openFileDialog: boolean) {
    assert(window.kiosk);
    setCurrentState(ModalState.Saving);

    try {
      const rawLogFile = await window.kiosk.readFile(FULL_LOG_PATH, 'utf8');
      let results = '';
      switch (logFileType) {
        case LogFileType.Raw:
          results = rawLogFile;
          break;
        case LogFileType.Cdf: {
          assert(electionDefinition);
          results = logger.buildCDFLog(
            electionDefinition,
            rawLogFile,
            machineConfig.machineId,
            machineConfig.codeVersion,
            userRole
          );
          break;
        }
        /* istanbul ignore next - compile time check for completeness */
        default:
          throwIllegalValue(logFileType);
      }
      let filenameLocation = '';
      if (openFileDialog) {
        const fileWriter = await window.kiosk.saveAs({
          defaultPath: defaultFilename,
        });

        if (!fileWriter) {
          throw new Error('could not save; no file was chosen');
        }
        await fileWriter.write(results);

        filenameLocation = fileWriter.filename;
        await fileWriter.end();
      } else {
        assert(usbDriveStatus.status === 'mounted');
        const pathToFile = join(usbDriveStatus.mountPoint, defaultFilename);
        await window.kiosk.writeFile(pathToFile, results);
        filenameLocation = defaultFilename;
      }

      setSavedFilename(filenameLocation);
      await sleep(2000);
      await logger.log(LogEventId.FileSaved, userRole, {
        disposition: 'success',
        message: `Successfully saved log file to ${filenameLocation} on the usb drive.`,
        fileType: 'logs',
        filename: filenameLocation,
      });
      setCurrentState(ModalState.Done);
    } catch (error) {
      assert(error instanceof Error);
      setErrorMessage(error.message);
      await logger.log(LogEventId.FileSaved, userRole, {
        disposition: 'failure',
        message: `Error saving log file: ${error.message}`,
        result: 'File not saved, error message shown to user.',
        fileType: 'logs',
      });
      setCurrentState(ModalState.Error);
    }
  }

  if (currentState === ModalState.Error) {
    return (
      <Modal
        title="Failed to Save Logs"
        content={<P>Failed to save log file. {errorMessage}</P>}
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  if (currentState === ModalState.Done) {
    return (
      <Modal
        title="Logs Saved"
        content={
          <P>
            Log file successfully saved{' '}
            {savedFilename !== '' && (
              <span>
                as <Font weight="bold">{savedFilename}</Font>
              </span>
            )}{' '}
            on the inserted USB drive.
          </P>
        }
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  if (currentState === ModalState.Saving) {
    return <Modal content={<Loading>Saving Logs</Loading>} />;
  }

  // istanbul ignore next
  if (currentState !== ModalState.Init) {
    throwIllegalValue(currentState);
  }

  if (isLocatingLogFile) {
    return (
      <Modal
        content={<Loading />}
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  if (!window.kiosk || !foundLogFile) {
    return (
      <Modal
        title="No Log File Present"
        content={<P>No log file detected on device.</P>}
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  switch (usbDriveStatus.status) {
    case 'no_drive':
    case 'ejected':
    case 'error':
      // When run not through kiosk mode let the user save the file
      // on the machine for internal debugging use
      return (
        <Modal
          title="No USB Drive Detected"
          content={
            <P>
              <UsbImage />
              Please insert a USB drive where you would like the save the log
              file.
            </P>
          }
          onOverlayClick={onClose}
          actions={
            <React.Fragment>
              {
                /* istanbul ignore next */ process.env.NODE_ENV ===
                  'development' && (
                  <Button onPress={() => exportLogs(true)}>Save</Button>
                )
              }
              <Button onPress={onClose}>Cancel</Button>
            </React.Fragment>
          }
        />
      );
    case 'mounted': {
      return (
        <Modal
          title="Save Logs"
          content={
            <P>
              Save the log file as <Font weight="bold">{defaultFilename}</Font>{' '}
              directly on the inserted USB drive?
            </P>
          }
          onOverlayClick={onClose}
          actions={
            <React.Fragment>
              <Button variant="primary" onPress={() => exportLogs(false)}>
                Save
              </Button>
              <Button onPress={onClose}>Cancel</Button>
              <Button onPress={() => exportLogs(true)}>Save As…</Button>
            </React.Fragment>
          }
        />
      );
    }
    // istanbul ignore next
    default:
      throwIllegalValue(usbDriveStatus);
  }
}

export type ExportLogsButtonProps = Omit<ExportLogsModalProps, 'onClose'>;

export function ExportLogsButton({
  logFileType,
  electionDefinition,
  ...rest
}: ExportLogsButtonProps): JSX.Element {
  const [isShowingModal, setIsShowingModal] = useState(false);

  return (
    <React.Fragment>
      <Button
        onPress={() => setIsShowingModal(true)}
        disabled={logFileType === 'cdf' && !electionDefinition}
      >
        {logFileType === 'raw' ? 'Save Log File' : 'Save CDF Log File'}
      </Button>
      {isShowingModal && (
        <ExportLogsModal
          logFileType={logFileType}
          electionDefinition={electionDefinition}
          {...rest}
          onClose={() => setIsShowingModal(false)}
        />
      )}
    </React.Fragment>
  );
}

export type ExportLogsButtonRowProps = Omit<
  ExportLogsButtonProps,
  'logFileType'
>;

export function ExportLogsButtonRow(
  sharedProps: ExportLogsButtonRowProps
): JSX.Element {
  return (
    <P>
      <ExportLogsButton logFileType={LogFileType.Raw} {...sharedProps} />{' '}
      <ExportLogsButton logFileType={LogFileType.Cdf} {...sharedProps} />
    </P>
  );
}

/*
 * Renders raw and CDF log export buttons without formatting
 */
export function ExportLogsButtonGroup(
  sharedProps: ExportLogsButtonRowProps
): JSX.Element {
  return (
    <React.Fragment>
      <ExportLogsButton logFileType={LogFileType.Raw} {...sharedProps} />
      <ExportLogsButton logFileType={LogFileType.Cdf} {...sharedProps} />
    </React.Fragment>
  );
}
