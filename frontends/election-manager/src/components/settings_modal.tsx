import React from 'react';
import { Button, Modal } from '@votingworks/ui';

interface Props {
  closeModal: () => void;
}

export function SettingsModal({ closeModal }: Props): JSX.Element {
  return (
    <Modal actions={<Button onPress={closeModal}>Close</Button>} fullscreen />
  );
}
