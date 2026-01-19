import './TeamResultView.css';

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {Link} from 'react-router';

import {
  AnalyzeResult,
  AuthoredTotals,
  ReceivedTotals,
  TeamInfo,
  UserActivitySummary,
  UserResult,
} from 'types/types';
import ValueCell from 'components/ValueCell';
import Panel from 'components/Panel';
import TimeSeriesChart from './chart/TimeSeriesChart';
import {accumulate} from './chart/utils';
import {ChartDataSeries, DateValue} from './chart/types';

function aggregateAuthoredTotals(members: ReadonlyArray<UserResult>): AuthoredTotals {
  let approvals = 0;
  let rejections = 0;
  let commentsWrittenTotal = 0;
  let commentsWrittenToOthers = 0;
  let changesCreated = 0;
  let commits = 0;
  let totalOpenTime = 0;
  let changeCount = 0;

  for (const member of members) {
    const t = member.aggregatedAuthoredTotals;
    approvals += t.approvals;
    rejections += t.rejections;
    commentsWrittenTotal += t.commentsWrittenTotal;
    commentsWrittenToOthers += t.commentsWrittenToOthers;
    changesCreated += t.changesCreated;
    commits += t.commits;
    if (t.changesCreated > 0) {
      totalOpenTime += t.meanChangeOpenTimeMsec * t.changesCreated;
      changeCount += t.changesCreated;
    }
  }

  return {
    approvals,
    rejections,
    commentsWrittenTotal,
    commentsWrittenToOthers,
    changesCreated,
    commits,
    meanChangeOpenTimeMsec: changeCount > 0 ? totalOpenTime / changeCount : 0,
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
        });
      } else {
        byDate.set(activity.date, {...activity});
      }
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
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

const TeamResultView: React.FC<Props> = ({className, team, members}) => {
  const authoredTotals = useMemo(() => aggregateAuthoredTotals(members), [members]);
  const receivedTotals = useMemo(() => aggregateReceivedTotals(members), [members]);
  const timeSeries = useMemo(() => aggregateTimeSeries(members), [members]);
  const timeSeriesData = useMemo(() => toTimeSeriesData(timeSeries), [timeSeries]);

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
          />
          <ValueCell
            tooltip="Total rejections given by team members."
            title="Rejections"
            value={authoredTotals.rejections}
          />
          <ValueCell
            tooltip="Total comments written by team members."
            title="Comments (Total)"
            value={authoredTotals.commentsWrittenTotal}
          />
          <ValueCell
            tooltip="Total comments written to others by team members."
            title="Comments to others"
            value={authoredTotals.commentsWrittenToOthers}
          />
          <ValueCell
            tooltip="Total change requests created by team members."
            title="Change requests"
            value={authoredTotals.changesCreated}
          />
          <ValueCell
            tooltip="Total commits created by team members."
            title="Commits"
            value={authoredTotals.commits}
          />
          <ValueCell
            tooltip="Average time changes have been open until merged (team average)."
            title="Average time in review"
            value={`${Math.round(authoredTotals.meanChangeOpenTimeMsec / 1000 / 60 / 60)}h`}
          />
          <ValueCell
            tooltip="Comments authored to others per review request received (team average)."
            title="Comments / Request"
            value={(authoredTotals.commentsWrittenToOthers / receivedTotals.reviewRequests).toFixed(
              1
            )}
          />
        </Panel>

        <Panel title="Received (Team Total)" size="third">
          <ValueCell
            tooltip="Total approvals received by team members."
            title="Approvals received"
            value={receivedTotals.approvals}
          />
          <ValueCell
            tooltip="Total rejections received by team members."
            title="Rejections received"
            value={receivedTotals.rejections}
          />
          <ValueCell
            tooltip="Total comments received by team members."
            title="Comments received"
            value={receivedTotals.commentsByOthers}
          />
          <ValueCell
            tooltip="Total review requests received by team members."
            title="Review requests"
            value={receivedTotals.reviewRequests}
          />
          <ValueCell
            tooltip="Comments received per change request (team average)."
            title="Comments / Change"
            value={(receivedTotals.commentsTotal / authoredTotals.changesCreated).toFixed(1)}
          />
          <ValueCell
            tooltip="Comments received per commit (team average)."
            title="Comments / Commit"
            value={(receivedTotals.commentsTotal / authoredTotals.commits).toFixed(1)}
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
    </div>
  );
};
TeamResultView.displayName = 'TeamResultView';

export default TeamResultView;
