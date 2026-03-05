import {NavLink} from 'react-router';

import {UserResult} from 'types/types';
import {SortableColumn} from 'components/Table';
import {formatIsoDate} from 'date/utils';
import {sum} from 'utils/math';

export function getUserOverviewColumns(): ReadonlyArray<SortableColumn<UserResult>> {
  return [
    {
      Header: 'Username',
      accessor: (row) => <NavLink to={`/analysis/people/${row.id}`}>{row.displayName}</NavLink>,
    },
    {
      Header: 'Change Requests',
      accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.changesCreated).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Lines Added',
      accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.linesAdded).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Lines Deleted',
      accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.linesDeleted).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Comments Written (All)',
      accessor: (row) =>
        row.repoTotals.map((repo) => repo.authoredTotals.commentsWrittenTotal).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Comments to Others',
      accessor: (row) =>
        row.repoTotals.map((repo) => repo.authoredTotals.commentsWrittenToOthers).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Approvals Given',
      accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.approvals).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Rejections Given',
      accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.rejections).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Comments Received',
      accessor: (row) =>
        row.repoTotals.map((repo) => repo.receivedTotals.commentsByOthers).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Approvals Received',
      accessor: (row) => row.repoTotals.map((repo) => repo.receivedTotals.approvals).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Rejections Received',
      accessor: (row) => row.repoTotals.map((repo) => repo.receivedTotals.rejections).reduce(sum),
      maxWidth: 100,
    },
    {
      Header: 'Review requests',
      accessor: (row) => row.aggregatedReceivedTotals.reviewRequests,
      maxWidth: 100,
    },
    {
      Header: 'Comments / Change',
      accessor: (row) => {
        const commentsPerChange =
          row.aggregatedReceivedTotals.commentsByOthers / row.aggregatedAuthoredTotals.changesCreated;
        return Number.isNaN(commentsPerChange) ? '-' : commentsPerChange.toFixed(3);
      },
      maxWidth: 100,
    },
    {
      Header: 'Comments / PR',
      accessor: (row) => {
        const commentsPerPR =
          row.aggregatedAuthoredTotals.commentsWrittenToOthers /
          row.aggregatedAuthoredTotals.distinctPRsCommentedOn;
        return Number.isNaN(commentsPerPR) ? '-' : commentsPerPR.toFixed(3);
      },
      maxWidth: 100,
    },

    {
      Header: 'First Seen',
      accessor: (row) => formatIsoDate(row.interval?.startDate),
      maxWidth: 100,
    },
    {
      Header: 'Last Seen',
      accessor: (row) => formatIsoDate(row.interval?.endDate),
      maxWidth: 100,
    },
    {
      Header: 'Active Days',
      accessor: (row) => row.activeDaysCount,
      maxWidth: 100,
    },
    {
      Header: 'Median time in Review (h)',
      accessor: (row) => {
        const msec = row.aggregatedAuthoredTotals.medianChangeOpenTimeMsec;
        return isNaN(msec) || !isFinite(msec) ? '-' : Math.round(msec / 1000 / 60 / 60);
      },
      maxWidth: 100,
    },
    {
      Header: 'Median Commit Size',
      accessor: (row) => {
        const size = row.aggregatedAuthoredTotals.medianCommitSize;
        return isNaN(size) || !isFinite(size) ? '-' : Math.round(size);
      },
      maxWidth: 100,
    },
  ];
}
