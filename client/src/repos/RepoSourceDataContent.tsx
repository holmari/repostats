import React from 'react';
import {Spinner} from 'react-bootstrap';
import {formatIsoDate} from 'date/utils';
import {RepoSourceDataMetadata} from 'types/types';
import GithubSourceDataMetadataContent from './GithubSourceDataMetadataContent';

const RepoSourceDataContent: React.FC<Props> = ({metadata}) => {
  if (!metadata) {
    return <Spinner animation="border" />;
  }

  const getRepoSpecificContent = () => {
    switch (metadata.type) {
      case 'GITHUB':
        return <GithubSourceDataMetadataContent metadata={metadata} />;
      default:
        throw new Error(`Unsupported connector type ${metadata.type}`);
    }
  };

  return (
    <>
      {getRepoSpecificContent()}
      <fieldset>
        <legend>Downloaded files location</legend>
        {metadata.downloadsPath || <Spinner animation="border" />}
      </fieldset>
      <fieldset>
        <legend>Last updated on server</legend>
        {formatIsoDate(metadata.updatedAt) || <Spinner animation="border" />}
      </fieldset>
    </>
  );
};
interface Props {
  metadata: RepoSourceDataMetadata | undefined;
}

RepoSourceDataContent.displayName = 'RepoSourceDataContent';
export default RepoSourceDataContent;
