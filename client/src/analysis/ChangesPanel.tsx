import React from 'react';

import Panel from 'components/Panel';
import {Change, UserResult} from 'types/types';
import Table, {SortableColumn} from 'components/Table';
import {CellProps} from 'react-table';
import Format from 'format/format';

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
    Header: 'Time open',
    accessor: (row) => row.timeOpenMsec,
    maxWidth: 100,
    Cell: (props: CellProps<UserResult, number>) => <span>{Format.duration(props.value)}</span>,
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
