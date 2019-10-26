import './ReviewCommentItem.css';

import React from 'react';
import {NavLink} from 'react-router-dom';

import {ReviewComment} from 'types/types';
import {formatIsoDateTime} from 'date/utils';

const ReviewCommentItem: React.FC<Props> = ({comment}) => {
  return (
    <div className="ReviewCommentItem">
      <div className="ReviewCommentItem__header">
        <div className="ReviewCommentItem__header-title">
          <a href={comment.reviewUrl} target="_blank" rel="noreferrer">
            {comment.reviewTitle}
          </a>{' '}
          by{' '}
          <NavLink to={`/analysis/people/${comment.recipientUserId}`}>
            {comment.recipientUserId}
          </NavLink>{' '}
        </div>
        <div className="ReviewCommentItem__header-timestamp">
          {formatIsoDateTime(comment.createdAt)}
        </div>
      </div>

      <div className="ReviewCommentItem__text">{comment.comment}</div>
    </div>
  );
};
ReviewCommentItem.displayName = 'ReviewCommentItem';
interface Props {
  comment: ReviewComment;
}

export default ReviewCommentItem;
