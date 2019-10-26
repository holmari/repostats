import React from 'react';
import {GithubSourceDataMetadata} from 'types/types';

const GithubSourceDataMetadataContent: React.FC<Props> = ({metadata}) => {
  return (
    <>
      <fieldset>
        <legend>Total # of pull requests in repository</legend>
        {metadata.totalPullsInRepository !== -1 ? metadata.totalPullsInRepository : 'Unknown'}
      </fieldset>
      <fieldset>
        <legend># of fetched PRs</legend>
        {metadata.fetchedPullNumbers.length}
      </fieldset>
      <fieldset>
        <legend>Total # of comments in repository</legend>
        {metadata.totalCommentCount !== -1 ? metadata.totalCommentCount : 'Unknown'}
      </fieldset>
      <fieldset>
        <legend># of fetched comments</legend>
        {metadata.fetchedCommentIds?.length || 0}
      </fieldset>
    </>
  );
};
GithubSourceDataMetadataContent.displayName = 'GithubSourceDataMetadataContent';
interface Props {
  metadata: GithubSourceDataMetadata;
}
export default GithubSourceDataMetadataContent;
