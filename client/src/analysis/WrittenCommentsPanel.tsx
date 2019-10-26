import React from 'react';

import Panel from 'components/Panel';
import {UserResult} from 'types/types';
import ReviewCommentItem from './ReviewCommentItem';

const WrittenCommentsPanel: React.FC<Props> = ({user}) => {
  return (
    <Panel title="Written comments" size="flex">
      {user.commentsAuthored.length ? (
        user.commentsAuthored.map((comment, index) => (
          <ReviewCommentItem comment={comment} key={index} />
        ))
      ) : (
        <span>This user has not written any comments.</span>
      )}
    </Panel>
  );
};
WrittenCommentsPanel.displayName = 'WrittenCommentsPanel';
interface Props {
  user: UserResult;
}

export default WrittenCommentsPanel;
