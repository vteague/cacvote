import {
  Button,
  Loading,
  Modal,
  Prose,
  UsbControllerButton,
  UsbDrive,
} from '@votingworks/ui';
import { throwIllegalValue, usbstick } from '@votingworks/utils';
import React, { useState } from 'react';
import styled from 'styled-components';
import { backupToUsbDrive } from '../api';

const UsbImage = styled.img`
  margin: 0 auto;
  height: 200px;
`;

export interface ExportBackupModalProps {
  onClose: () => void;
  usbDrive: UsbDrive;
}

enum ModalState {
  ERROR = 'error',
  SAVING = 'saving',
  DONE = 'done',
  INIT = 'init',
}

const DEFAULT_ERROR = 'Failed to save backup.';

export function ExportBackupModal({
  onClose,
  usbDrive,
}: ExportBackupModalProps): JSX.Element {
  const backupToUsbDriveMutation = backupToUsbDrive.useMutation();
  const [currentState, setCurrentState] = useState(ModalState.INIT);
  const [errorMessage, setErrorMessage] = useState('');

  async function exportBackup() {
    setCurrentState(ModalState.SAVING);

    const usbPath = await usbstick.getPath();
    if (!usbPath) {
      setErrorMessage('No USB drive found.');
      setCurrentState(ModalState.ERROR);
      return;
    }

    backupToUsbDriveMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.isErr()) {
          setErrorMessage(result.err().message ?? DEFAULT_ERROR);
          setCurrentState(ModalState.ERROR);
        } else {
          setCurrentState(ModalState.DONE);
        }
      },
    });
  }

  if (currentState === ModalState.ERROR) {
    return (
      <Modal
        content={
          <Prose>
            <h1>Failed to Save Backup</h1>
            <p>{errorMessage}</p>
          </Prose>
        }
        onOverlayClick={onClose}
        actions={<Button onPress={onClose}>Close</Button>}
      />
    );
  }

  if (currentState === ModalState.DONE) {
    if (usbDrive.status === 'ejected') {
      return (
        <Modal
          content={
            <Prose>
              <h1>Backup Saved</h1>
              <p>USB drive successfully ejected.</p>
            </Prose>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Close</Button>}
        />
      );
    }

    return (
      <Modal
        content={
          <Prose>
            <h1>Backup Saved</h1>
            <p>
              Backup file saved successfully! You may now eject the USB drive.
            </p>
          </Prose>
        }
        onOverlayClick={onClose}
        actions={
          <React.Fragment>
            <UsbControllerButton
              small={false}
              primary
              usbDriveStatus={usbDrive.status}
              usbDriveEject={() => usbDrive.eject('election_manager')}
            />
            <Button onPress={onClose}>Cancel</Button>
          </React.Fragment>
        }
      />
    );
  }

  if (currentState === ModalState.SAVING) {
    return <Modal content={<Loading>Saving Backup</Loading>} />;
  }

  /* istanbul ignore next - compile time check for completeness */
  if (currentState !== ModalState.INIT) {
    throwIllegalValue(currentState);
  }

  switch (usbDrive.status) {
    case 'absent':
    case 'ejected':
    case 'bad_format':
      // When run not through kiosk mode let the user save the file
      // on the machine for internal debugging use
      return (
        <Modal
          content={
            <Prose>
              <h1>No USB Drive Detected</h1>
              <p>
                Please insert a USB drive to save the backup.
                <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              </p>
            </Prose>
          }
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Cancel</Button>}
        />
      );
    case 'ejecting':
    case 'mounting':
      return (
        <Modal
          content={<Loading />}
          onOverlayClick={onClose}
          actions={<Button onPress={onClose}>Cancel</Button>}
        />
      );
    case 'mounted':
      return (
        <Modal
          content={
            <Prose>
              <h1>Save Backup</h1>
              <UsbImage src="/assets/usb-drive.svg" alt="Insert USB Image" />
              <p>
                A ZIP file will automatically be saved to the default location
                on the mounted USB drive.
              </p>
            </Prose>
          }
          onOverlayClick={onClose}
          actions={
            <React.Fragment>
              <Button primary onPress={exportBackup}>
                Save
              </Button>
              <Button onPress={onClose}>Cancel</Button>
            </React.Fragment>
          }
        />
      );
    default:
      throwIllegalValue(usbDrive.status);
  }
}
