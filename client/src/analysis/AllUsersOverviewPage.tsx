import './AllUsersOverviewPage.css';

import React, {useMemo} from 'react';
import {NavLink} from 'react-router-dom';

import {AnalyzeResult, UserResult} from 'types/types';
import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';
import {formatIsoDate} from 'date/utils';
import Format from 'format/format';
import {CellProps} from 'react-table';

const sum = (acc: number, item: number) => acc + item;

const columns: ReadonlyArray<SortableColumn<UserResult>> = [
  {
    Header: 'Username',
    accessor: (row) => <NavLink to={`/analysis/people/${row.id}`}>{row.displayName}</NavLink>,
  },
  {
    Header: 'Change Requests',
    accessor: (row) =>
      row.repoTotals.map((repo) => repo.authoredTotals.changesCreated).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Comments Written (All)',
    accessor: (row) =>
      row.repoTotals.map((repo) => repo.authoredTotals.commentsWrittenTotal).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Comments to Others',
    accessor: (row) =>
      row.repoTotals.map((repo) => repo.authoredTotals.commentsWrittenToOthers).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Approvals Given',
    accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.approvals).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Rejections Given',
    accessor: (row) => row.repoTotals.map((repo) => repo.authoredTotals.rejections).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Comments Received',
    accessor: (row) =>
      row.repoTotals.map((repo) => repo.receivedTotals.commentsByOthers).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Approvals Received',
    accessor: (row) => row.repoTotals.map((repo) => repo.receivedTotals.approvals).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Rejections Received',
    accessor: (row) => row.repoTotals.map((repo) => repo.receivedTotals.rejections).reduce(sum, 0),
    maxWidth: 100,
  },
  {
    Header: 'Review requests',
    accessor: (row) => row.aggregatedReceivedTotals.reviewRequests,
    maxWidth: 100,
  },
  {
    Header: 'Comments / Change',
    accessor: (row) =>
      row.aggregatedReceivedTotals.commentsByOthers / row.aggregatedAuthoredTotals.changesCreated,
    maxWidth: 100,
    Cell: (props: CellProps<UserResult, number>) => Format.ratio(props.value),
  },
  {
    Header: 'Comments / Request',
    accessor: (row) =>
      row.aggregatedAuthoredTotals.commentsWrittenToOthers /
      row.aggregatedReceivedTotals.reviewRequests,
    maxWidth: 100,
    Cell: (props: CellProps<UserResult, number>) => Format.ratio(props.value),
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
    Header: 'Avg. time in Review',
    accessor: (row) => row.aggregatedAuthoredTotals.meanChangeOpenTimeMsec,
    maxWidth: 100,
    Cell: (props: CellProps<UserResult, number>) => <span>{Format.duration(props.value)}</span>,
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
