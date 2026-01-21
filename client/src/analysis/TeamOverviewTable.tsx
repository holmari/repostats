import React, {useMemo} from 'react';

import {UserResult} from 'types/types';
import Table from 'components/Table';
import {getUserOverviewColumns} from './columns/userColumns';

interface Props {
  members: ReadonlyArray<UserResult>;
}

const TeamOverviewTable: React.FC<Props> = ({members}) => {
  const columns = useMemo(() => getUserOverviewColumns(), []);

  return <Table columns={columns} data={members} />;
};
TeamOverviewTable.displayName = 'TeamOverviewTable';

export default TeamOverviewTable;
