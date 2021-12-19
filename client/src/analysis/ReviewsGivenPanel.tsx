import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';

import {UserResult} from 'types/types';
import {removeDuplicates} from 'arrays/utils';

interface ReviewsGivenEntry {
  readonly userId: string;
  readonly userDisplayName: string;
  readonly timesAskedToReview: number;
  readonly commentsWritten: number;
  readonly approvalsGiven: number;
  readonly rejectionsGiven: number;
  readonly commentsPerChange: number;
}

const columns: ReadonlyArray<SortableColumn<ReviewsGivenEntry>> = [
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
    Header: 'Comments Written',
    accessor: (row) => row.commentsWritten,
    maxWidth: 100,
  },
  {
    Header: 'Approvals Given',
    accessor: (row) => row.approvalsGiven,
    maxWidth: 120,
  },
  {
    Header: 'Rejections Given',
    accessor: (row) => row.rejectionsGiven,
    maxWidth: 120,
  },
  {
    Header: 'Comments / Change',
    accessor: (row) =>
      Number.isFinite(row.commentsPerChange) ? row.commentsPerChange.toFixed(2) : '-',
    maxWidth: 120,
  },
];

function toEntries(userResult: UserResult): ReadonlyArray<ReviewsGivenEntry> {
  const requestedReviewUserIds = Object.keys(userResult.reviewRequestsReceivedByUserId);
  const commentsWrittenToUserIds = Object.keys(userResult.commentsWrittenByUserId);
  const reviewedUserIds = Object.keys(userResult.authoredReviewsByUserId);

  const userIds = removeDuplicates([
    ...requestedReviewUserIds,
    ...commentsWrittenToUserIds,
    ...reviewedUserIds,
  ]);

  return userIds.map((userId) => {
    return {
      userId,
      userDisplayName: userId,
      timesAskedToReview: userResult.reviewRequestsReceivedByUserId[userId] || 0,
      commentsWritten: userResult.commentsWrittenByUserId[userId] || 0,
      approvalsGiven: userResult.authoredReviewsByUserId[userId]?.approvals || 0,
      rejectionsGiven: userResult.authoredReviewsByUserId[userId]?.rejections || 0,
      commentsPerChange: userResult.commentsAuthoredPerChangeByUserId[userId] || 0,
    };
  });
}

const ReviewsGivenPanel: React.FC<Props> = ({user}) => {
  const data = useMemo(() => toEntries(user), [user]);
  return (
    <Panel title="Reviews given to users" size="half">
      {data.length ? (
        <Table columns={columns} data={data} />
      ) : (
        <span>This user has not participated in any reviews.</span>
      )}
    </Panel>
  );
};
ReviewsGivenPanel.displayName = 'ReviewsGivenPanel';

interface Props {
  user: UserResult;
}

export default ReviewsGivenPanel;
