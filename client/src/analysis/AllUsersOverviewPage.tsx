import './AllUsersOverviewPage.css';

import * as d3 from 'd3';
import {DateTime} from 'luxon';
import React, {useMemo, useState} from 'react';
import {useOutletContext} from 'react-router';
import {ExportToCsv, Options} from 'export-to-csv';

import {Change, DateInterval, Granularity, TeamInfo, UserResult} from 'types/types';
import Panel from 'components/Panel';
import Table, {SortableColumn} from 'components/Table';
import {AnalysisOutletContext} from './AnalysisPage';
import {getUserOverviewColumns} from './columns/userColumns';
import TimeSeriesChart, {formatHoursMinutes} from './chart/TimeSeriesChart';
import {ChartDataSeries, DateValue} from './chart/types';

function getPeriodStartDate(dateStr: string, granularity: Granularity): string {
  const dt = DateTime.fromISO(dateStr);
  switch (granularity) {
    case 'day':
      return dateStr.slice(0, 10);
    case 'week':
      return dt.startOf('week').toISODate()!;
    case 'month':
      return dt.startOf('month').toISODate()!;
    case 'quarter':
      return dt.startOf('quarter').toISODate()!;
    case 'year':
      return dt.startOf('year').toISODate()!;
  }
}

function computePercentile(sortedValues: ReadonlyArray<number>, percentile: number): number {
  if (sortedValues.length === 0) {
    return NaN;
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower];
  }
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function formatTimeInHours(msec: number): string {
  if (isNaN(msec) || !isFinite(msec)) {
    return '-';
  }
  return `${Math.round(msec / 1000 / 60 / 60)}h`;
}

interface TeamTurnaroundData {
  readonly team: TeamInfo;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  readonly p95: number;
  readonly changesCount: number;
}

function computeTeamTurnaroundData(
  teams: ReadonlyArray<TeamInfo>,
  userResults: ReadonlyArray<UserResult>
): ReadonlyArray<TeamTurnaroundData> {
  return teams
    .map((team) => {
      const members = userResults.filter((user) =>
        team.memberLogins.some(
          (login) => login.toLowerCase() === user.displayName.toLowerCase()
        )
      );

      const allChangeTimes: number[] = [];
      for (const member of members) {
        for (const change of member.changesAuthored) {
          allChangeTimes.push(change.timeOpenMsec);
        }
      }

      const sorted = allChangeTimes.sort((a, b) => a - b);

      return {
        team,
        p25: computePercentile(sorted, 25),
        p50: computePercentile(sorted, 50),
        p75: computePercentile(sorted, 75),
        p90: computePercentile(sorted, 90),
        p95: computePercentile(sorted, 95),
        changesCount: allChangeTimes.length,
      };
    })
    .filter((data) => data.changesCount > 0);
}

function getTeamTurnaroundColumns(): ReadonlyArray<SortableColumn<TeamTurnaroundData>> {
  return [
    {
      Header: 'Team',
      accessor: (row) => row.team.name,
      width: 200,
    },
    {
      Header: 'Changes',
      accessor: (row) => row.changesCount,
      width: 80,
    },
    {
      Header: 'p25',
      accessor: (row) => (isNaN(row.p25) ? -1 : row.p25),
      Cell: ({row}: {row: {original: TeamTurnaroundData}}) => formatTimeInHours(row.original.p25),
      width: 80,
    },
    {
      Header: 'p50',
      accessor: (row) => (isNaN(row.p50) ? -1 : row.p50),
      Cell: ({row}: {row: {original: TeamTurnaroundData}}) => formatTimeInHours(row.original.p50),
      width: 80,
    },
    {
      Header: 'p75',
      accessor: (row) => (isNaN(row.p75) ? -1 : row.p75),
      Cell: ({row}: {row: {original: TeamTurnaroundData}}) => formatTimeInHours(row.original.p75),
      width: 80,
    },
    {
      Header: 'p90',
      accessor: (row) => (isNaN(row.p90) ? -1 : row.p90),
      Cell: ({row}: {row: {original: TeamTurnaroundData}}) => formatTimeInHours(row.original.p90),
      width: 80,
    },
    {
      Header: 'p95',
      accessor: (row) => (isNaN(row.p95) ? -1 : row.p95),
      Cell: ({row}: {row: {original: TeamTurnaroundData}}) => formatTimeInHours(row.original.p95),
      width: 80,
    },
  ];
}

const teamTurnaroundColumns = getTeamTurnaroundColumns();

type PercentileOption = 25 | 50 | 75 | 90 | 95;

const PERCENTILE_OPTIONS: ReadonlyArray<PercentileOption> = [25, 50, 75, 90, 95];

type TimeExtractor = (change: Change) => number | null;

function computeTeamPercentileTimeSeries(
  teams: ReadonlyArray<TeamInfo>,
  userResults: ReadonlyArray<UserResult>,
  granularity: Granularity,
  requestedInterval: DateInterval,
  percentile: PercentileOption,
  extractTime: TimeExtractor
): ReadonlyArray<ChartDataSeries> {
  const colors = d3.schemeTableau10;

  // Helper to get all changes for a team's members within the requested interval
  function getTeamChanges(team: TeamInfo): ReadonlyArray<Change> {
    const members = userResults.filter((user) =>
      team.memberLogins.some(
        (login) => login.toLowerCase() === user.displayName.toLowerCase()
      )
    );
    return members.flatMap((member) => member.changesAuthored).filter((change) => {
      const createdAt = change.createdAt.slice(0, 10);
      return createdAt >= requestedInterval.startDate.slice(0, 10) &&
             createdAt <= requestedInterval.endDate.slice(0, 10);
    });
  }

  return teams
    .map((team, index) => {
      const changes = getTeamChanges(team);
      if (changes.length === 0) {
        return null;
      }

      // Group changes by period, extracting the relevant time value
      const changesByPeriod = new Map<string, number[]>();
      for (const change of changes) {
        const timeValue = extractTime(change);
        if (timeValue === null) {
          continue;
        }
        const period = getPeriodStartDate(change.createdAt, granularity);
        const existing = changesByPeriod.get(period) || [];
        existing.push(timeValue);
        changesByPeriod.set(period, existing);
      }

      // Compute percentile for each period
      const series: ReadonlyArray<DateValue> = Array.from(changesByPeriod.entries())
        .map(([period, times]) => {
          const sorted = times.sort((a, b) => a - b);
          const pValue = computePercentile(sorted, percentile);
          // Convert to hours for display
          const pValueHours = isNaN(pValue) ? 0 : pValue / 1000 / 60 / 60;

          return {
            date: new Date(period),
            value: pValueHours,
            count: times.length,
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (series.length === 0) {
        return null;
      }

      const result: ChartDataSeries = {
        label: team.name,
        color: colors[index % colors.length],
        series,
      };
      return result;
    })
    .filter((series): series is ChartDataSeries => series !== null);
}

const extractTimeOpen: TimeExtractor = (change) => change.timeOpenMsec;
const extractTimeToFirstReview: TimeExtractor = (change) => change.timeToFirstReviewMsec;

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

interface PercentileSelectorProps {
  readonly options: ReadonlyArray<PercentileOption>;
  readonly selected: PercentileOption;
  readonly onChange: (p: PercentileOption) => void;
}

const PercentileSelector: React.FC<PercentileSelectorProps> = ({options, selected, onChange}) => (
  <div className="AllUsersOverviewPage__percentile-selector">
    {options.map((p) => (
      <button
        key={p}
        className={`AllUsersOverviewPage__percentile-btn ${selected === p ? 'AllUsersOverviewPage__percentile-btn--active' : ''}`}
        onClick={() => onChange(p)}
      >
        p{p}
      </button>
    ))}
  </div>
);

const AllUsersOverviewPage: React.FC = () => {
  const {result, teams} = useOutletContext<AnalysisOutletContext>();
  const [turnaroundPercentile, setTurnaroundPercentile] = useState<PercentileOption>(50);
  const [firstReviewPercentile, setFirstReviewPercentile] = useState<PercentileOption>(50);
  const data = useMemo(() => Object.values(result.userResults), [result]);
  const teamTurnaroundData = useMemo(
    () => computeTeamTurnaroundData(teams, data),
    [teams, data]
  );
  const turnaroundTimeSeries = useMemo(
    () => computeTeamPercentileTimeSeries(
      teams, data, result.granularity, result.requestedInterval, turnaroundPercentile, extractTimeOpen
    ),
    [teams, data, result.granularity, result.requestedInterval, turnaroundPercentile]
  );
  const firstReviewTimeSeries = useMemo(
    () => computeTeamPercentileTimeSeries(
      teams, data, result.granularity, result.requestedInterval, firstReviewPercentile, extractTimeToFirstReview
    ),
    [teams, data, result.granularity, result.requestedInterval, firstReviewPercentile]
  );

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
      {teamTurnaroundData.length > 0 && (
        <Panel title="Change Request Turnaround Time by Team" size="flex">
          <Table columns={teamTurnaroundColumns} data={teamTurnaroundData} />
        </Panel>
      )}
      {turnaroundTimeSeries.length > 0 && (
        <Panel title="Turnaround Time by Team Over Time" size="flex">
          <PercentileSelector
            options={PERCENTILE_OPTIONS}
            selected={turnaroundPercentile}
            onChange={setTurnaroundPercentile}
          />
          <TimeSeriesChart data={turnaroundTimeSeries} yAxisLabel="Hours" valueFormatter={formatHoursMinutes} />
        </Panel>
      )}
      {firstReviewTimeSeries.length > 0 && (
        <Panel title="Time to First Review by Team Over Time" size="flex">
          <PercentileSelector
            options={PERCENTILE_OPTIONS}
            selected={firstReviewPercentile}
            onChange={setFirstReviewPercentile}
          />
          <TimeSeriesChart data={firstReviewTimeSeries} yAxisLabel="Hours" valueFormatter={formatHoursMinutes} />
        </Panel>
      )}
    </div>
  );
};
AllUsersOverviewPage.displayName = 'AllUsersOverviewPage';

export default AllUsersOverviewPage;
