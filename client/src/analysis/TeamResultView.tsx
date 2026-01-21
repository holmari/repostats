import './TeamResultView.css';

import classNames from 'classnames';
import * as d3 from 'd3';
import React, {useMemo} from 'react';
import {Link} from 'react-router';

import {
  AnalyzeResult,
  AuthoredTotals,
  AuthoredTotalsComparison,
  MetricComparison,
  ReceivedTotals,
  ReceivedTotalsComparison,
  TeamInfo,
  UserActivitySummary,
  UserResult,
  UserResultComparison,
} from 'types/types';
import ValueCell from 'components/ValueCell';
import Panel from 'components/Panel';
import TimeSeriesChart from './chart/TimeSeriesChart';
import {accumulate} from './chart/utils';
import {ChartDataSeries, DateValue} from './chart/types';
import {AUTHORED_METRIC_POLARITY, computeRatioComparison, RECEIVED_METRIC_POLARITY} from './metricPolarity';
import TeamOverviewTable from './TeamOverviewTable';
import TeamMemberGraphPanel from './TeamMemberGraphPanel';

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

function aggregateAuthoredTotals(members: ReadonlyArray<UserResult>): AuthoredTotals {
  let approvals = 0;
  let rejections = 0;
  let commentsWrittenTotal = 0;
  let commentsWrittenToOthers = 0;
  let changesCreated = 0;
  let commits = 0;
  let linesAdded = 0;
  let linesDeleted = 0;

  // Collect all change times for percentile computation
  const allChangeTimes: number[] = [];

  for (const member of members) {
    const t = member.aggregatedAuthoredTotals;
    approvals += t.approvals;
    rejections += t.rejections;
    commentsWrittenTotal += t.commentsWrittenTotal;
    commentsWrittenToOthers += t.commentsWrittenToOthers;
    changesCreated += t.changesCreated;
    commits += t.commits;
    linesAdded += t.linesAdded;
    linesDeleted += t.linesDeleted;

    // Collect individual change times for proper percentile computation
    for (const change of member.changesAuthored) {
      allChangeTimes.push(change.timeOpenMsec);
    }
  }

  // Compute percentiles from all changes
  const sorted = allChangeTimes.sort((a, b) => a - b);

  return {
    approvals,
    rejections,
    commentsWrittenTotal,
    commentsWrittenToOthers,
    changesCreated,
    commits,
    medianChangeOpenTimeMsec: computePercentile(sorted, 50),
    p25ChangeOpenTimeMsec: computePercentile(sorted, 25),
    p90ChangeOpenTimeMsec: computePercentile(sorted, 90),
    p99ChangeOpenTimeMsec: computePercentile(sorted, 99),
    linesAdded,
    linesDeleted,
  };
}

function aggregateReceivedTotals(members: ReadonlyArray<UserResult>): ReceivedTotals {
  let approvals = 0;
  let rejections = 0;
  let commentsTotal = 0;
  let commentsByOthers = 0;
  let reviewRequests = 0;

  for (const member of members) {
    const t = member.aggregatedReceivedTotals;
    approvals += t.approvals;
    rejections += t.rejections;
    commentsTotal += t.commentsTotal;
    commentsByOthers += t.commentsByOthers;
    reviewRequests += t.reviewRequests;
  }

  return {
    approvals,
    rejections,
    commentsTotal,
    commentsByOthers,
    reviewRequests,
  };
}

function sumMetricComparisons(comparisons: ReadonlyArray<MetricComparison>): MetricComparison {
  let currentValue = 0;
  let previousValue = 0;
  for (const c of comparisons) {
    currentValue += c.currentValue;
    previousValue += c.previousValue;
  }
  const percentageChange = previousValue === 0 ? null : ((currentValue - previousValue) / previousValue) * 100;
  return {currentValue, previousValue, percentageChange};
}

function aggregateTeamComparison(
  members: ReadonlyArray<UserResult>,
  comparisonResults: {readonly [userId: string]: UserResultComparison} | undefined
): UserResultComparison | undefined {
  if (!comparisonResults) {
    return undefined;
  }

  const memberComparisons = members
    .map((m) => comparisonResults[m.id])
    .filter((c): c is UserResultComparison => c !== undefined);

  if (memberComparisons.length === 0) {
    return undefined;
  }

  const authoredTotals: AuthoredTotalsComparison = {
    approvals: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.approvals)),
    rejections: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.rejections)),
    commentsWrittenTotal: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.commentsWrittenTotal)),
    commentsWrittenToOthers: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.commentsWrittenToOthers)),
    changesCreated: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.changesCreated)),
    commits: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.commits)),
    medianChangeOpenTimeMsec: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.medianChangeOpenTimeMsec)),
    linesAdded: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.linesAdded)),
    linesDeleted: sumMetricComparisons(memberComparisons.map((c) => c.authoredTotals.linesDeleted)),
  };

  const receivedTotals: ReceivedTotalsComparison = {
    approvals: sumMetricComparisons(memberComparisons.map((c) => c.receivedTotals.approvals)),
    rejections: sumMetricComparisons(memberComparisons.map((c) => c.receivedTotals.rejections)),
    commentsTotal: sumMetricComparisons(memberComparisons.map((c) => c.receivedTotals.commentsTotal)),
    commentsByOthers: sumMetricComparisons(memberComparisons.map((c) => c.receivedTotals.commentsByOthers)),
    reviewRequests: sumMetricComparisons(memberComparisons.map((c) => c.receivedTotals.reviewRequests)),
  };

  return {authoredTotals, receivedTotals};
}

function aggregateTimeSeries(
  members: ReadonlyArray<UserResult>
): ReadonlyArray<UserActivitySummary> {
  const byDate = new Map<string, UserActivitySummary>();

  for (const member of members) {
    for (const activity of member.timeSeries) {
      const existing = byDate.get(activity.date);
      if (existing) {
        byDate.set(activity.date, {
          date: activity.date,
          commentsAuthored: existing.commentsAuthored + activity.commentsAuthored,
          commentsReceived: existing.commentsReceived + activity.commentsReceived,
          changesAuthored: existing.changesAuthored + activity.changesAuthored,
          commitsAuthored: existing.commitsAuthored + activity.commitsAuthored,
          reviewsAuthored: {
            approvals: existing.reviewsAuthored.approvals + activity.reviewsAuthored.approvals,
            rejections: existing.reviewsAuthored.rejections + activity.reviewsAuthored.rejections,
          },
          reviewsReceived: {
            approvals: existing.reviewsReceived.approvals + activity.reviewsReceived.approvals,
            rejections: existing.reviewsReceived.rejections + activity.reviewsReceived.rejections,
          },
          linesAdded: existing.linesAdded + (activity.linesAdded || 0),
          linesDeleted: existing.linesDeleted + (activity.linesDeleted || 0),
        });
      } else {
        byDate.set(activity.date, {
          ...activity,
          linesAdded: activity.linesAdded || 0,
          linesDeleted: activity.linesDeleted || 0,
        });
      }
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function toLinesChangedPerMemberData(
  members: ReadonlyArray<UserResult>
): ReadonlyArray<ChartDataSeries> {
  const colors = d3.schemeTableau10;

  return members.map((member, index) => {
    const series: DateValue[] = member.timeSeries
      .filter((activity) => (activity.linesAdded || 0) + (activity.linesDeleted || 0) > 0)
      .map((activity) => ({
        date: new Date(activity.date),
        value: (activity.linesAdded || 0) + (activity.linesDeleted || 0),
      }));

    return {
      label: member.displayName,
      color: colors[index % colors.length],
      series: accumulate(series),
    };
  });
}

function toCommentsAuthoredPerMemberData(
  members: ReadonlyArray<UserResult>
): ReadonlyArray<ChartDataSeries> {
  const colors = d3.schemeTableau10;

  return members.map((member, index) => {
    const series: DateValue[] = member.timeSeries
      .filter((activity) => activity.commentsAuthored > 0)
      .map((activity) => ({
        date: new Date(activity.date),
        value: activity.commentsAuthored,
      }));

    return {
      label: member.displayName,
      color: colors[index % colors.length],
      series: accumulate(series),
    };
  });
}

function toCommentsReceivedPerMemberData(
  members: ReadonlyArray<UserResult>
): ReadonlyArray<ChartDataSeries> {
  const colors = d3.schemeTableau10;

  return members.map((member, index) => {
    const series: DateValue[] = member.timeSeries
      .filter((activity) => activity.commentsReceived > 0)
      .map((activity) => ({
        date: new Date(activity.date),
        value: activity.commentsReceived,
      }));

    return {
      label: member.displayName,
      color: colors[index % colors.length],
      series: accumulate(series),
    };
  });
}

function toCommitsAuthoredPerMemberData(
  members: ReadonlyArray<UserResult>
): ReadonlyArray<ChartDataSeries> {
  const colors = d3.schemeTableau10;

  return members.map((member, index) => {
    const series: DateValue[] = member.timeSeries
      .filter((activity) => activity.commitsAuthored > 0)
      .map((activity) => ({
        date: new Date(activity.date),
        value: activity.commitsAuthored,
      }));

    return {
      label: member.displayName,
      color: colors[index % colors.length],
      series: accumulate(series),
    };
  });
}

function toTimeSeriesData(
  timeSeries: ReadonlyArray<UserActivitySummary>
): ReadonlyArray<ChartDataSeries> {
  const commitsAuthoredSeries: DateValue[] = [];
  const changesAuthoredSeries: DateValue[] = [];
  const commentsReceivedSeries: DateValue[] = [];

  timeSeries.forEach((activity) => {
    commitsAuthoredSeries.push({date: new Date(activity.date), value: activity.commitsAuthored});
    changesAuthoredSeries.push({date: new Date(activity.date), value: activity.changesAuthored});
    commentsReceivedSeries.push({date: new Date(activity.date), value: activity.commentsReceived});
  });

  return [
    {label: 'Commits Authored', color: '#4a91ff', series: accumulate(commitsAuthoredSeries)},
    {label: 'Changes Authored', color: '#ff8270', series: accumulate(changesAuthoredSeries)},
    {label: 'Comments Received', color: '#a3cc27', series: accumulate(commentsReceivedSeries)},
  ];
}

interface Props {
  className?: string;
  team: TeamInfo;
  members: ReadonlyArray<UserResult>;
  fullResult: AnalyzeResult;
}

const TeamResultView: React.FC<Props> = ({className, team, members, fullResult}) => {
  const authoredTotals = useMemo(() => aggregateAuthoredTotals(members), [members]);
  const receivedTotals = useMemo(() => aggregateReceivedTotals(members), [members]);
  const timeSeries = useMemo(() => aggregateTimeSeries(members), [members]);
  const timeSeriesData = useMemo(() => toTimeSeriesData(timeSeries), [timeSeries]);
  const linesChangedPerMemberData = useMemo(() => toLinesChangedPerMemberData(members), [members]);
  const commentsAuthoredPerMemberData = useMemo(
    () => toCommentsAuthoredPerMemberData(members),
    [members]
  );
  const commentsReceivedPerMemberData = useMemo(
    () => toCommentsReceivedPerMemberData(members),
    [members]
  );
  const commitsAuthoredPerMemberData = useMemo(
    () => toCommitsAuthoredPerMemberData(members),
    [members]
  );
  const comparison = useMemo(
    () => aggregateTeamComparison(members, fullResult.comparisonResults),
    [members, fullResult.comparisonResults]
  );
  const comparisonGranularity = fullResult.comparisonGranularity;

  return (
    <div className={classNames('TeamResultView', className)}>
      <Panel title={team.name} titleClass="h1" size="flex">
        <div className="TeamResultView__members">
          <span className="TeamResultView__members-label">Members:</span>
          {members.length === 0 ? (
            <span className="TeamResultView__no-members">No members found in analysis.</span>
          ) : (
            members.map((member, index) => (
              <span key={member.id}>
                <Link to={`/analysis/people/${member.id}`} className="TeamResultView__member-link">
                  {member.displayName}
                </Link>
                {index < members.length - 1 && ', '}
              </span>
            ))
          )}
        </div>
      </Panel>

      <div className="TeamResultView__row">
        <Panel title="Authored (Team Total)" size="third">
          <ValueCell
            tooltip="Total approvals given by team members."
            title="Approvals"
            value={authoredTotals.approvals}
            comparison={comparison?.authoredTotals.approvals}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.approvals}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total rejections given by team members."
            title="Rejections"
            value={authoredTotals.rejections}
            comparison={comparison?.authoredTotals.rejections}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.rejections}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total comments written by team members."
            title="Comments (Total)"
            value={authoredTotals.commentsWrittenTotal}
            comparison={comparison?.authoredTotals.commentsWrittenTotal}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commentsWrittenTotal}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total comments written to others by team members."
            title="Comments to others"
            value={authoredTotals.commentsWrittenToOthers}
            comparison={comparison?.authoredTotals.commentsWrittenToOthers}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commentsWrittenToOthers}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total change requests created by team members."
            title="Change requests"
            value={authoredTotals.changesCreated}
            comparison={comparison?.authoredTotals.changesCreated}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.changesCreated}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total commits created by team members."
            title="Commits"
            value={authoredTotals.commits}
            comparison={comparison?.authoredTotals.commits}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commits}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total lines of code added by team members."
            title="Lines Added"
            value={authoredTotals.linesAdded.toLocaleString()}
            comparison={comparison?.authoredTotals.linesAdded}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.linesAdded}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total lines of code deleted by team members."
            title="Lines Deleted"
            value={authoredTotals.linesDeleted.toLocaleString()}
            comparison={comparison?.authoredTotals.linesDeleted}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.linesDeleted}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Median time changes have been open until merged (team median)."
            title="Median time in review"
            value={formatTimeInHours(authoredTotals.medianChangeOpenTimeMsec)}
            comparison={comparison?.authoredTotals.medianChangeOpenTimeMsec}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.medianChangeOpenTimeMsec}
            comparisonGranularity={comparisonGranularity}
            cornerContent={
              <>
                <div>p25: {formatTimeInHours(authoredTotals.p25ChangeOpenTimeMsec)}</div>
                <div>p90: {formatTimeInHours(authoredTotals.p90ChangeOpenTimeMsec)}</div>
                <div>p99: {formatTimeInHours(authoredTotals.p99ChangeOpenTimeMsec)}</div>
              </>
            }
          />
          <ValueCell
            tooltip="Comments authored to others per review request received (team average)."
            title="Comments / Request"
            value={(authoredTotals.commentsWrittenToOthers / receivedTotals.reviewRequests).toFixed(
              1
            )}
            comparison={computeRatioComparison(
              comparison?.authoredTotals.commentsWrittenToOthers,
              comparison?.receivedTotals.reviewRequests
            )}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commentsWrittenToOthers}
            comparisonGranularity={comparisonGranularity}
          />
        </Panel>

        <Panel title="Received (Team Total)" size="third">
          <ValueCell
            tooltip="Total approvals received by team members."
            title="Approvals received"
            value={receivedTotals.approvals}
            comparison={comparison?.receivedTotals.approvals}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.approvals}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total rejections received by team members."
            title="Rejections received"
            value={receivedTotals.rejections}
            comparison={comparison?.receivedTotals.rejections}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.rejections}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total comments received by team members."
            title="Comments received"
            value={receivedTotals.commentsByOthers}
            comparison={comparison?.receivedTotals.commentsByOthers}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.commentsByOthers}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Total review requests received by team members."
            title="Review requests"
            value={receivedTotals.reviewRequests}
            comparison={comparison?.receivedTotals.reviewRequests}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.reviewRequests}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Comments received per change request (team average)."
            title="Comments / Change"
            value={(receivedTotals.commentsTotal / authoredTotals.changesCreated).toFixed(1)}
            comparison={computeRatioComparison(
              comparison?.receivedTotals.commentsTotal,
              comparison?.authoredTotals.changesCreated
            )}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.commentsTotal}
            comparisonGranularity={comparisonGranularity}
          />
          <ValueCell
            tooltip="Comments received per commit (team average)."
            title="Comments / Commit"
            value={(receivedTotals.commentsTotal / authoredTotals.commits).toFixed(1)}
            comparison={computeRatioComparison(
              comparison?.receivedTotals.commentsTotal,
              comparison?.authoredTotals.commits
            )}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.commentsTotal}
            comparisonGranularity={comparisonGranularity}
          />
        </Panel>

        <Panel title="Team Stats" size="third">
          <ValueCell
            tooltip="Number of team members included in this analysis."
            title="Active Members"
            value={members.length}
          />
          <ValueCell
            tooltip="Average commits per team member."
            title="Commits / Member"
            value={(authoredTotals.commits / members.length).toFixed(1)}
          />
          <ValueCell
            tooltip="Average changes per team member."
            title="Changes / Member"
            value={(authoredTotals.changesCreated / members.length).toFixed(1)}
          />
        </Panel>
      </div>

      <Panel title="Team activity over time" size="flex">
        {timeSeriesData.length > 0 ? (
          <TimeSeriesChart data={timeSeriesData} />
        ) : (
          <span>No activity data available for this team.</span>
        )}
      </Panel>

      <Panel title="Lines changed per member over time" size="flex">
        {linesChangedPerMemberData.some((d) => d.series.length > 0) ? (
          <TimeSeriesChart data={linesChangedPerMemberData} />
        ) : (
          <span>No line change data available for this team.</span>
        )}
      </Panel>

      <Panel title="Comments per member over time" size="flex">
        <div className="TeamResultView__charts-row">
          <div className="TeamResultView__chart-half">
            <h4 className="TeamResultView__chart-subtitle">Comments Authored</h4>
            {commentsAuthoredPerMemberData.some((d) => d.series.length > 0) ? (
              <TimeSeriesChart data={commentsAuthoredPerMemberData} size={{width: 400, height: 300}} />
            ) : (
              <span>No comments authored data available.</span>
            )}
          </div>
          <div className="TeamResultView__chart-half">
            <h4 className="TeamResultView__chart-subtitle">Comments Received</h4>
            {commentsReceivedPerMemberData.some((d) => d.series.length > 0) ? (
              <TimeSeriesChart data={commentsReceivedPerMemberData} size={{width: 400, height: 300}} />
            ) : (
              <span>No comments received data available.</span>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Commits authored per member over time" size="flex">
        {commitsAuthoredPerMemberData.some((d) => d.series.length > 0) ? (
          <TimeSeriesChart data={commitsAuthoredPerMemberData} />
        ) : (
          <span>No commits data available for this team.</span>
        )}
      </Panel>

      <Panel title="Team Members" size="flex">
        {members.length > 0 ? (
          <TeamOverviewTable members={members} />
        ) : (
          <span>No members found in analysis.</span>
        )}
      </Panel>

      <TeamMemberGraphPanel members={members} fullResult={fullResult} />
    </div>
  );
};
TeamResultView.displayName = 'TeamResultView';

export default TeamResultView;
