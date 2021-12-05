import React from 'react';

import Panel from 'components/Panel';
import {Change, UserResult} from 'types/types';
import Table, {SortableColumn} from 'components/Table';

const columns: ReadonlyArray<SortableColumn<Change>> = [
  {
    Header: 'Title',
    accessor: (row) => <a href={row.reviewUrl}>{row.title}</a>,
    minWidth: 300,
    maxWidth: 400,
  },
  {
    Header: 'Repository',
    accessor: (row) => row.repoName,
    maxWidth: 120,
  },
  {
    Header: 'Created at',
    accessor: (row) => row.createdAt,
    maxWidth: 170,
  },
  {
    Header: 'Time open (h)',
    accessor: (row) => (row.timeOpenMsec / 1000 / 60 / 60).toFixed(2),
    maxWidth: 100,
  },
];

const ChangesPanel: React.FC<Props> = ({user}) => {
  return (
    <Panel title="Authored Changes" size="flex">
      <Table columns={columns} data={user.changesAuthored} />
    </Panel>
  );
};
ChangesPanel.displayName = 'ChangesPanel';

interface Props {
  user: UserResult;
}

export default ChangesPanel;
