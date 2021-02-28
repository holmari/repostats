import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';

import {UserResult} from 'types/types';
import {removeDuplicates} from 'arrays/utils';

interface ReviewsRequestedEntry {
  readonly userId: string;
  readonly userDisplayName: string;
  readonly timesAskedToReview: number;
  readonly comments: number;
  readonly approvals: number;
  readonly rejections: number;
}

const columns: ReadonlyArray<SortableColumn<ReviewsRequestedEntry>> = [
  {
    Header: 'Username',
    accessor: (row) => <a href={`/analysis/people/${row.userId}`}>{row.userDisplayName}</a>,
  },
  {
    Header: '# of Reviews Requested',
    accessor: (row) => row.timesAskedToReview,
    maxWidth: 100,
  },
  {
    Header: 'Comments Received',
    accessor: (row) => row.comments,
    maxWidth: 100,
  },
  {
    Header: 'Approvals Received',
    accessor: (row) => row.approvals,
    maxWidth: 120,
  },
  {
    Header: 'Rejections Received',
    accessor: (row) => row.rejections,
    maxWidth: 120,
  },
];

function toEntries(userResult: UserResult): ReadonlyArray<ReviewsRequestedEntry> {
  const authoredRequestUserIds = Object.keys(userResult.reviewRequestsAuthoredByUserId);
  const commentsWrittenToUserIds = Object.keys(userResult.commentsReceivedByUserId);
  const reviewedUserIds = Object.keys(userResult.authoredReviewsByUserId);

  const userIds = removeDuplicates([
    ...authoredRequestUserIds,
    ...commentsWrittenToUserIds,
    ...reviewedUserIds,
  ]);

  return userIds.map((userId) => {
    return {
      userId,
      userDisplayName: userId,
      timesAskedToReview: userResult.reviewRequestsAuthoredByUserId[userId]?.timesAdded || 0,
      comments: userResult.commentsReceivedByUserId[userId] || 0,
      approvals: userResult.reviewsReceivedByUserId[userId]?.approvals || 0,
      rejections: userResult.reviewsReceivedByUserId[userId]?.rejections || 0,
    };
  });
}

const ReviewsRequestedPanel: React.FC<Props> = ({user}) => {
  const data = useMemo(() => toEntries(user), [user]);
  return (
    <Panel title="Adds them as reviewers" size="half">
      {data.length ? (
        <Table columns={columns} data={data} />
      ) : (
        <span>This user has not participated in any reviews.</span>
      )}
    </Panel>
  );
};
ReviewsRequestedPanel.displayName = 'ReviewsRequestedPanel';

interface Props {
  user: UserResult;
}

export default ReviewsRequestedPanel;
