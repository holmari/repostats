import './Table.css';

import {useMemo} from 'react';
import {
  Column,
  HeaderGroup,
  UseSortByColumnOptions,
  UseSortByColumnProps,
  useTable,
  useSortBy,
  useBlockLayout,
} from 'react-table';

export type SortableColumn<T extends object> = Column<T> & UseSortByColumnOptions<T>;
export type SortableColumnProps<T extends object> = HeaderGroup<T> & UseSortByColumnProps<T>;

function Table<T extends object>({columns, data}: Props<T>) {
  const mutableColumns = useMemo(() => [...columns], [columns]);
  const mutableData = useMemo(() => [...data], [data]);
  const tableInstance = useTable(
    {columns: mutableColumns, data: mutableData},
    useSortBy,
    useBlockLayout
  );

  return (
    <table className="Table" {...tableInstance.getTableProps()}>
      <thead>
        {tableInstance.headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => {
              const sortableColumn: SortableColumnProps<T> = column as SortableColumnProps<T>;
              return (
                <th {...column.getHeaderProps(sortableColumn.getSortByToggleProps())}>
                  {column.render('Header')}
                  <span className="Table__sort-arrow">
                    {sortableColumn.isSorted ? (sortableColumn.isSortedDesc ? '⬇' : '⬆') : ''}
                  </span>
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody {...tableInstance.getTableBodyProps()}>
        {tableInstance.rows.map((row) => {
          tableInstance.prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map((cell) => {
                return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
Table.displayName = 'Table';

interface Props<T extends object> {
  columns: ReadonlyArray<SortableColumn<T>>;
  data: ReadonlyArray<T>;
}

export default Table;
