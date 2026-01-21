import './UserActivityTablePanel.css';

import React, {useMemo} from 'react';
import {DateTime} from 'luxon';

import {Granularity, UserActivitySummary, UserResult} from 'types/types';
import Panel from 'components/Panel';

interface MetricRow {
  readonly label: string;
  readonly getValue: (summary: UserActivitySummary) => number;
}

const METRIC_ROWS: ReadonlyArray<MetricRow> = [
  {label: 'Commits', getValue: (s) => s.commitsAuthored},
  {label: 'Changes', getValue: (s) => s.changesAuthored},
  {label: 'Lines Added', getValue: (s) => s.linesAdded},
  {label: 'Lines Deleted', getValue: (s) => s.linesDeleted},
  {label: 'Comments Written', getValue: (s) => s.commentsAuthored},
  {label: 'Comments Received', getValue: (s) => s.commentsReceived},
  {label: 'Approvals Given', getValue: (s) => s.reviewsAuthored.approvals},
  {label: 'Rejections Given', getValue: (s) => s.reviewsAuthored.rejections},
  {label: 'Approvals Received', getValue: (s) => s.reviewsReceived.approvals},
  {label: 'Rejections Received', getValue: (s) => s.reviewsReceived.rejections},
];

function formatColumnHeader(dateStr: string, granularity: Granularity): string {
  const dt = DateTime.fromISO(dateStr);

  switch (granularity) {
    case 'day':
    case 'week':
      // Show week number and year: "W01 '24"
      return `W${dt.weekNumber.toString().padStart(2, '0')} '${dt.year.toString().slice(-2)}`;
    case 'month':
      // Show month abbreviation and year: "Jan '24"
      return `${dt.monthShort} '${dt.year.toString().slice(-2)}`;
    case 'quarter':
      // Show quarter: "Q1 '24"
      return `Q${dt.quarter} '${dt.year.toString().slice(-2)}`;
    case 'year':
      // Show year: "2024"
      return dt.year.toString();
    default:
      return dateStr;
  }
}

function getEffectiveGranularity(granularity: Granularity | undefined): Granularity {
  // Default to 'week' if granularity is 'day' or undefined
  if (!granularity || granularity === 'day') {
    return 'week';
  }
  return granularity;
}

interface Props {
  user: UserResult;
  granularity: Granularity | undefined;
}

const UserActivityTablePanel: React.FC<Props> = ({user, granularity}) => {
  const effectiveGranularity = getEffectiveGranularity(granularity);

  // Sort time series by date (oldest first for left-to-right reading)
  const sortedTimeSeries = useMemo(() => {
    return [...user.timeSeries].sort((a, b) => a.date.localeCompare(b.date));
  }, [user.timeSeries]);

  if (sortedTimeSeries.length === 0) {
    return (
      <Panel title="Activity by Period" size="flex">
        <span>No activity data available.</span>
      </Panel>
    );
  }

  return (
    <Panel title="Activity by Period" size="flex">
      <div className="UserActivityTablePanel__container">
        <table className="UserActivityTablePanel__table">
          <thead>
            <tr>
              <th className="UserActivityTablePanel__metric-header">Metric</th>
              {sortedTimeSeries.map((summary) => (
                <th key={summary.date} className="UserActivityTablePanel__period-header">
                  {formatColumnHeader(summary.date, effectiveGranularity)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((metric) => (
              <tr key={metric.label}>
                <td className="UserActivityTablePanel__metric-label">{metric.label}</td>
                {sortedTimeSeries.map((summary) => {
                  const value = metric.getValue(summary);
                  return (
                    <td
                      key={summary.date}
                      className="UserActivityTablePanel__value"
                      title={`${metric.label}: ${value.toLocaleString()}`}
                    >
                      {value > 0 ? value.toLocaleString() : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};
UserActivityTablePanel.displayName = 'UserActivityTablePanel';

export default UserActivityTablePanel;
