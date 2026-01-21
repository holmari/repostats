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
        {tableInstance.headerGroups.map((headerGroup) => {
          const {key: headerGroupKey, ...headerGroupProps} = headerGroup.getHeaderGroupProps();
          return (
            <tr key={headerGroupKey} {...headerGroupProps}>
              {headerGroup.headers.map((column) => {
                const sortableColumn: SortableColumnProps<T> = column as SortableColumnProps<T>;
                const {key: columnKey, ...columnProps} = column.getHeaderProps(
                  sortableColumn.getSortByToggleProps()
                );
                return (
                  <th key={columnKey} {...columnProps}>
                    {column.render('Header')}
                    <span className="Table__sort-arrow">
                      {sortableColumn.isSorted ? (sortableColumn.isSortedDesc ? '⬇' : '⬆') : ''}
                    </span>
                  </th>
                );
              })}
            </tr>
          );
        })}
      </thead>
      <tbody {...tableInstance.getTableBodyProps()}>
        {tableInstance.rows.map((row) => {
          tableInstance.prepareRow(row);
          const {key: rowKey, ...rowProps} = row.getRowProps();
          return (
            <tr key={rowKey} {...rowProps}>
              {row.cells.map((cell) => {
                const {key: cellKey, ...cellProps} = cell.getCellProps();
                return (
                  <td key={cellKey} {...cellProps}>
                    {cell.render('Cell')}
                  </td>
                );
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
