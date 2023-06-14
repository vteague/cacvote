import React from 'react';
import pluralize from 'pluralize';

import { throwIllegalValue } from '@votingworks/basics';
import { Modal, Prose, Button } from '@votingworks/ui';
import { ResultsFileType } from '../config/types';
import { getCastVoteRecordFiles, getManualResultsMetadata } from '../api';

export interface Props {
  onConfirm: (fileType: ResultsFileType) => void;
  onCancel: () => void;
  fileType: ResultsFileType;
}

export function ConfirmRemovingFileModal({
  onConfirm,
  onCancel,
  fileType,
}: Props): JSX.Element | null {
  const manualDataResultsMetadataQuery = getManualResultsMetadata.useQuery();
  const castVoteRecordFilesQuery = getCastVoteRecordFiles.useQuery();

  if (
    !castVoteRecordFilesQuery.isSuccess ||
    !manualDataResultsMetadataQuery.isSuccess
  ) {
    return null;
  }

  const hasManualData = manualDataResultsMetadataQuery.data.length > 0;

  let mainContent: React.ReactNode = null;
  let fileTypeName = '';
  let singleFileRemoval = true;
  switch (fileType) {
    case ResultsFileType.CastVoteRecord: {
      const fileList = castVoteRecordFilesQuery.data;
      singleFileRemoval = fileList.length <= 1;
      fileTypeName = 'CVR Files';
      mainContent = (
        <React.Fragment>
          <p>
            Do you want to remove the {fileList.length} loaded CVR{' '}
            {pluralize('files', fileList.length)}?
          </p>
          <p>All reports will be unavailable without CVR data.</p>
        </React.Fragment>
      );
      break;
    }
    case ResultsFileType.All: {
      fileTypeName = 'Data';
      singleFileRemoval = false;
      const fileList = castVoteRecordFilesQuery.data;
      mainContent = (
        <React.Fragment>
          <p>
            Do you want to remove the {fileList.length} loaded CVR{' '}
            {pluralize('files', fileList.length)}
            {hasManualData && ' and the manually entered data'}?
          </p>
          <p>All reports will be unavailable without CVR data.</p>
        </React.Fragment>
      );
      break;
    }
    default:
      throwIllegalValue(fileType);
  }

  return (
    <Modal
      centerContent
      content={<Prose textCenter>{mainContent}</Prose>}
      actions={
        <React.Fragment>
          <Button variant="danger" onPress={() => onConfirm(fileType)}>
            Remove {!singleFileRemoval && 'All'} {fileTypeName}
          </Button>
          <Button onPress={onCancel}>Cancel</Button>
        </React.Fragment>
      }
      onOverlayClick={onCancel}
    />
  );
}
