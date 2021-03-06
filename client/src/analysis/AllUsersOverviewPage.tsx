import './AllUsersOverviewPage.css';

import React, {useMemo} from 'react';

import {AnalyzeResult, UserResult} from 'types/types';
import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';
import {formatIsoDate} from 'date/utils';

const sum = (acc: number, item: number) => acc + item;

const columns: ReadonlyArray<SortableColumn<UserResult>> = [
  {
    Header: 'Username',
    accessor: (row) => <a href={`/analysis/people/${row.id}`}>{row.id}</a>,
  },
  {
    Header: 'Change Requests',
    accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.changesCreated).reduce(sum),
    maxWidth: 100,
  },
  {
    Header: 'Comments Written',
    accessor: (row) =>
      row.repoTotals.map((repo) => repo.authoredTotals.commentsWritten).reduce(sum),
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
    accessor: (row) => row.repoTotals.map((repo) => repo.receivedTotals.comments).reduce(sum),
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
    Header: 'Comments / Change',
    accessor: (row) => {
      const commentsPerChange =
        row.repoTotals.map((repo) => repo.receivedTotals.comments).reduce(sum) /
        row.repoTotals.map((repo) => repo.authoredTotals.changesCreated).reduce(sum);
      return Number.isNaN(commentsPerChange) ? '-' : commentsPerChange.toFixed(3);
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
