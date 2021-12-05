import './AllUsersOverviewPage.css';

import React, {useMemo} from 'react';
import {NavLink} from 'react-router-dom';

import {AnalyzeResult, UserResult} from 'types/types';
import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';
import {formatIsoDate} from 'date/utils';

const sum = (acc: number, item: number) => acc + item;

const columns: ReadonlyArray<SortableColumn<UserResult>> = [
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
    Header: 'Comments / Request',
    accessor: (row) => {
      const commentsPerRequest =
        row.aggregatedAuthoredTotals.commentsWrittenToOthers /
        row.aggregatedReceivedTotals.reviewRequests;
      return Number.isNaN(commentsPerRequest) ? '-' : commentsPerRequest.toFixed(3);
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
    Header: 'Avg. time in Review (h)',
    accessor: (row) =>
      Math.round(row.aggregatedAuthoredTotals.meanChangeOpenTimeMsec / 1000 / 60 / 60),
    maxWidth: 100,
  },
];

const AllUsersOverviewPage: React.FC<Props> = ({result}) => {
  const data = useMemo(() => Object.values(result.userResults), [result]);

  return (
    <div className="AllUsersOverviewPage">
      <Panel title="Overview" size="flex">
        <Table columns={columns} data={data} />
      </Panel>
    </div>
  );
};
AllUsersOverviewPage.displayName = 'AllUsersOverviewPage';

interface Props {
  result: AnalyzeResult;
}

export default AllUsersOverviewPage;
