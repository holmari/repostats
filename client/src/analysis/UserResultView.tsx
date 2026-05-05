import './UserResultView.css';

import classNames from 'classnames';
import React from 'react';

import {AnalyzeResult, UserResult} from 'types/types';
import ValueCell from 'components/ValueCell';
import {AUTHORED_METRIC_POLARITY, computeRatioComparison, RECEIVED_METRIC_POLARITY} from './metricPolarity';
import Panel from 'components/Panel';
import {formatIsoDate, getIntervalDuration} from 'date/utils';
import RepositoriesContributionPanel from './RepositoriesContributionPanel';
import ReviewsGivenPanel from './ReviewsGivenPanel';
import ReviewsRequestedPanel from './ReviewsRequestedPanel';
import AuthoredChangesOverTimePanel from './AuthoredChangesOverTimePanel';
import ReviewedChangesOverTimePanel from './ReviewedChangesOverTimePanel';
import WrittenCommentsPanel from './WrittenCommentsPanel';
import UserHeaderPanel from './UserHeaderPanel';
import TeamGraphPanel from './TeamGraphPanel';
import ChangesPanel from './ChangesPanel';
import UserFileStatsPanel from './UserFileStatsPanel';
import UserActivityTablePanel from './UserActivityTablePanel';

function formatTimeInHours(msec: number): string {
  if (isNaN(msec) || !isFinite(msec)) {
    return '-';
  }
  return `${Math.round(msec / 1000 / 60 / 60)}h`;
}

function formatCommitSize(lines: number): string {
  if (isNaN(lines) || !isFinite(lines)) {
    return '-';
  }
  return Math.round(lines).toLocaleString();
}

function formatRatio(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return '-';
  }
  return value.toFixed(1);
}

const UserResultView: React.FC<Props> = ({className, fullResult, user}) => {
  const authoredTotals = user.aggregatedAuthoredTotals;
  const receivedTotals = user.aggregatedReceivedTotals;
  const comparison = fullResult.comparisonResults?.[user.id];
  const comparisonGranularity = fullResult.comparisonGranularity;

  return (
    <div className={classNames('UserResultView', className)}>
      <UserHeaderPanel user={user} />

      <div className="UserResultView__row">
        <Panel title="Authored" size="third">
          <ValueCell
            tooltip="How many approvals this user has given to others."
            title="Approvals"
            value={authoredTotals.approvals}
            comparison={comparison?.authoredTotals.approvals}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.approvals}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many times this user has requested adjustments to others' code."
            title="Rejections"
            value={authoredTotals.rejections}
            comparison={comparison?.authoredTotals.rejections}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.rejections}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many comments this user has written in total."
            title="Comments (Total)"
            value={authoredTotals.commentsWrittenTotal}
            comparison={comparison?.authoredTotals.commentsWrittenTotal}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commentsWrittenTotal}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many comments this user has written to other people's change requests."
            title="Comments to others"
            value={authoredTotals.commentsWrittenToOthers}
            comparison={comparison?.authoredTotals.commentsWrittenToOthers}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commentsWrittenToOthers}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many change requests this user has initiated. In GitHub, the term 'Pull Request' is used."
            title="Change requests"
            value={authoredTotals.changesCreated}
            comparison={comparison?.authoredTotals.changesCreated}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.changesCreated}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many commits this user has created."
            title="Commits"
            value={authoredTotals.commits}
            comparison={comparison?.authoredTotals.commits}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commits}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="Lines of code added by this user."
            title="Lines Added"
            value={authoredTotals.linesAdded.toLocaleString()}
            comparison={comparison?.authoredTotals.linesAdded}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.linesAdded}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="Lines of code deleted by this user."
            title="Lines Deleted"
            value={authoredTotals.linesDeleted.toLocaleString()}
            comparison={comparison?.authoredTotals.linesDeleted}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.linesDeleted}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="Median number of lines changed (added + deleted) per commit."
            title="Median commit size"
            value={formatCommitSize(authoredTotals.medianCommitSize)}
            comparison={comparison?.authoredTotals.medianCommitSize}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.medianCommitSize}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How long this user's changes have been open until merged (median)."
            title="Median time in review"
            value={formatTimeInHours(authoredTotals.medianChangeOpenTimeMsec)}
            comparison={comparison?.authoredTotals.medianChangeOpenTimeMsec}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.medianChangeOpenTimeMsec}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
            formatComparisonValue={formatTimeInHours}
            cornerContent={
              <>
                <div>p25: {formatTimeInHours(authoredTotals.p25ChangeOpenTimeMsec)}</div>
                <div>p90: {formatTimeInHours(authoredTotals.p90ChangeOpenTimeMsec)}</div>
                <div>p99: {formatTimeInHours(authoredTotals.p99ChangeOpenTimeMsec)}</div>
              </>
            }
          />
          <ValueCell
            tooltip="The ratio of comments the user authored to others per distinct PR reviewed."
            title="Comments / PR"
            value={(
              authoredTotals.commentsWrittenToOthers / authoredTotals.distinctPRsCommentedOn
            ).toFixed(1)}
            comparison={computeRatioComparison(
              comparison?.authoredTotals.commentsWrittenToOthers,
              comparison?.authoredTotals.distinctPRsCommentedOn
            )}
            comparisonPolarity={AUTHORED_METRIC_POLARITY.commentsWrittenToOthers}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
            formatComparisonValue={formatRatio}
          />
        </Panel>

        <Panel title="Received" size="third">
          <ValueCell
            tooltip="How many approvals this user has received."
            title="Approvals received"
            value={receivedTotals.approvals}
            comparison={comparison?.receivedTotals.approvals}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.approvals}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many times this user's changes have been rejected by others."
            title="Rejections received"
            value={receivedTotals.rejections}
            comparison={comparison?.receivedTotals.rejections}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.rejections}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many comments this user has received from others."
            title="Comments received"
            value={receivedTotals.commentsByOthers}
            comparison={comparison?.receivedTotals.commentsByOthers}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.commentsByOthers}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="How many times this user has been requested to be a reviewer, either directly or through one of the teams they belong to."
            title="Review requests"
            value={receivedTotals.reviewRequests}
            comparison={comparison?.receivedTotals.reviewRequests}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.reviewRequests}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
          />
          <ValueCell
            tooltip="The ratio of comments the user received and the change requests the user created."
            title="Comments / Change"
            value={(receivedTotals.commentsTotal / authoredTotals.changesCreated).toFixed(1)}
            comparison={computeRatioComparison(
              comparison?.receivedTotals.commentsTotal,
              comparison?.authoredTotals.changesCreated
            )}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.commentsTotal}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
            formatComparisonValue={formatRatio}
          />
          <ValueCell
            tooltip="The ratio of comments the user received and the commits the user created."
            title="Comments / Commit"
            value={(receivedTotals.commentsTotal / authoredTotals.commits).toFixed(1)}
            comparison={computeRatioComparison(
              comparison?.receivedTotals.commentsTotal,
              comparison?.authoredTotals.commits
            )}
            comparisonPolarity={RECEIVED_METRIC_POLARITY.commentsTotal}
            comparisonGranularity={comparisonGranularity}
            dateInterval={fullResult.requestedInterval}
            formatComparisonValue={formatRatio}
          />
        </Panel>
        <Panel title="Timeline" size="third">
          <ValueCell
            tooltip="When the user's first activity was recorded in the given evaluation interval."
            title="First seen"
            fontSize="small"
            value={user.interval?.startDate ? formatIsoDate(user.interval?.startDate) : 'Unknown'}
          />
          <ValueCell
            tooltip="When the user's last activity was recorded in the given evaluation interval."
            title="Last seen"
            fontSize="small"
            value={user.interval?.endDate ? formatIsoDate(user.interval?.endDate) : 'Unknown'}
          />
          <ValueCell
            tooltip="How many days the user was active in the given evaluation interval."
            title="Total Days"
            value={Math.round(getIntervalDuration(user.interval, 'days'))}
          />
          <ValueCell
            tooltip="How many days the user was active in the given evaluation interval."
            title="Active Days"
            value={user.activeDaysCount}
          />
        </Panel>
      </div>
      <div className="UserResultView__row">
        <ReviewsGivenPanel user={user} />
        <ReviewsRequestedPanel user={user} />
      </div>

      <TeamGraphPanel user={user} fullResult={fullResult} />

      <AuthoredChangesOverTimePanel user={user} />

      <ReviewedChangesOverTimePanel user={user} />

      <UserActivityTablePanel user={user} granularity={fullResult.granularity} />

      <RepositoriesContributionPanel user={user} />

      <UserFileStatsPanel user={user} fullResult={fullResult} />

      <ChangesPanel user={user} />

      <WrittenCommentsPanel user={user} />
    </div>
  );
};

interface Props {
  className?: string;
  user: UserResult;
  fullResult: AnalyzeResult;
}

UserResultView.displayName = 'UserResultView';

export default UserResultView;
