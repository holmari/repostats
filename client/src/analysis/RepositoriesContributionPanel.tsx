import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';

import {UserRepoTotals, UserResult} from 'types/types';

const authoredColumns: ReadonlyArray<SortableColumn<UserRepoTotals>> = [
  {
    Header: 'Repository',
    accessor: (row) => row.repoName,
  },
  {
    Header: 'Approvals Given',
    accessor: (row) => row.authoredTotals.approvals,
  },
  {
    Header: 'Rejections Given',
    accessor: (row) => row.authoredTotals.rejections,
  },
  {
    Header: 'Comments Written',
    accessor: (row) => row.authoredTotals.commentsWrittenTotal,
  },
  {
    Header: 'Change Requests Authored',
    accessor: (row) => row.authoredTotals.changesCreated,
  },
];

const receivedColumns: ReadonlyArray<SortableColumn<UserRepoTotals>> = [
  {
    Header: 'Repository',
    accessor: (row) => row.repoName,
  },
  {
    Header: 'Approvals Received',
    accessor: (row) => row.receivedTotals.approvals,
  },
  {
    Header: 'Rejections Received',
    accessor: (row) => row.receivedTotals.rejections,
  },
  {
    Header: 'Comments Received',
    accessor: (row) => row.receivedTotals.commentsTotal,
  },
];

const RepositoriesContributionPanel: React.FC<Props> = ({user}) => {
  const data = useMemo(() => user.repoTotals.flatMap((totals) => totals), [user.repoTotals]);

  return (
    <>
      <Panel title="Authored across repositories" size="flex">
        <Table columns={authoredColumns} data={data} />
      </Panel>
      <Panel title="Received across repositories" size="flex">
        <Table columns={receivedColumns} data={data} />
      </Panel>
    </>
  );
};
RepositoriesContributionPanel.displayName = 'RepositoriesContributionPanel';

interface Props {
  user: UserResult;
}

export default RepositoriesContributionPanel;
