import './AllUsersOverviewPage.css';

import React, {useMemo} from 'react';
import {useOutletContext} from 'react-router';
import {ExportToCsv, Options} from 'export-to-csv';

import {UserResult} from 'types/types';
import Panel from 'components/Panel';
import Table from 'components/Table';
import {AnalysisOutletContext} from './AnalysisPage';
import {getUserOverviewColumns} from './columns/userColumns';

const csvExportOptions: Options = {
  fieldSeparator: ',',
  quoteStrings: '"',
  decimalSeparator: '.',
  showLabels: true,
  showTitle: false,
  filename: 'repostats',
  useTextFile: false,
  useBom: true,
  useKeysAsHeaders: true,
};

const columns = getUserOverviewColumns();

export function exportToCsv(users: ReadonlyArray<UserResult>) {
  const exportableData = users.map((userResult) => {
    const mappedData: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const accessor = column.accessor;
      if (accessor && column.Header && typeof accessor === 'function') {
        mappedData[`${column.Header}`] = accessor(userResult, index, {
          subRows: [],
          depth: 0,
          data: [userResult],
        });
      }
    });
    // special case due to the need for using a NavLink in the accessor
    mappedData['Username'] = userResult.displayName;
    return mappedData;
  });

  const csvExporter = new ExportToCsv(csvExportOptions);
  csvExporter.generateCsv(exportableData);
}

const AllUsersOverviewPage: React.FC = () => {
  const { result } = useOutletContext<AnalysisOutletContext>();
  const data = useMemo(() => Object.values(result.userResults), [result]);

  return (
    <div className="AllUsersOverviewPage">
      <Panel title="Overview" size="flex">
        <button
          className="AllUsersOverviewPage__export-button btn btn-primary"
          onClick={() => exportToCsv(data)}
        >
          Export to CSV
        </button>
        <Table columns={columns} data={data} />
      </Panel>
    </div>
  );
};
AllUsersOverviewPage.displayName = 'AllUsersOverviewPage';

export default AllUsersOverviewPage;
