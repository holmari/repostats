import './UserResultView.css';

import classNames from 'classnames';
import React from 'react';

import {AnalyzeResult, UserResult} from 'types/types';
import ValueCell from 'components/ValueCell';
import Panel from 'components/Panel';
import {formatIsoDate, getIntervalDuration} from 'date/utils';
import {aggregateAuthoredTotals, aggregateReceivedTotals} from './utils';
import RepositoriesContributionPanel from './RepositoriesContributionPanel';
import ReviewsGivenPanel from './ReviewsGivenPanel';
import ReviewsRequestedPanel from './ReviewsRequestedPanel';
import AuthoredChangesOverTimePanel from './AuthoredChangesOverTimePanel';
import ReviewedChangesOverTimePanel from './ReviewedChangesOverTimePanel';
import WrittenCommentsPanel from './WrittenCommentsPanel';
import UserHeaderPanel from './UserHeaderPanel';
import TeamGraphPanel from './TeamGraphPanel';

const UserResultView: React.FC<Props> = ({className, fullResult, user}) => {
  const authoredTotals = aggregateAuthoredTotals(user);
  const receivedTotals = aggregateReceivedTotals(user);

  return (
    <div className={classNames('UserResultView', className)}>
      <UserHeaderPanel user={user} />

      <div className="UserResultView__row">
        <Panel title="Authored" size="third">
          <ValueCell
            tooltip="How many approvals this user has given to others."
            title="Approvals"
            value={authoredTotals.approvals}
          />
          <ValueCell
            tooltip="How many times this user has requested adjustments to others' code."
            title="Rejections"
            value={authoredTotals.rejections}
          />
          <ValueCell
            tooltip="How many comments this user has written in total."
            title="Comments (Total)"
            value={authoredTotals.commentsWrittenTotal}
          />
          <ValueCell
            tooltip="How many comments this user has written to other people's change requests."
            title="Comments to others"
            value={authoredTotals.commentsWrittenToOthers}
          />
          <ValueCell
            tooltip="How many change requests this user has initiated. In GitHub, the term 'Pull Request' is used."
            title="Change requests"
            value={authoredTotals.changesCreated}
          />
          <ValueCell
            tooltip="How many commits this user has created."
            title="Commits"
            value={authoredTotals.commits}
          />
          <ValueCell
            tooltip="How long this user's changes have been open until merged."
            title="Average time in review"
            value={`${Math.round(authoredTotals.meanChangeOpenTimeMsec / 1000 / 60 / 60)}h`}
          />
        </Panel>

        <Panel title="Received" size="third">
          <ValueCell
            tooltip="How many approvals this user has received."
            title="Approvals received"
            value={receivedTotals.approvals}
          />
          <ValueCell
            tooltip="How many times this user's changes have been rejected by others."
            title="Rejections received"
            value={receivedTotals.rejections}
          />
          <ValueCell
            tooltip="How many comments this user has received from others."
            title="Comments received"
            value={receivedTotals.commentsByOthers}
          />
          <ValueCell
            tooltip="How many times this user has been requested to be a reviewer, either directly or through one of the teams they belong to."
            title="Review requests"
            value={receivedTotals.reviewRequests}
          />
          <ValueCell
            tooltip="The ratio of comments the user received and the change requests the user created."
            title="Comments / Change"
            value={(receivedTotals.commentsTotal / authoredTotals.changesCreated).toFixed(1)}
          />
          <ValueCell
            tooltip="The ratio of comments the user received and the commits the user created."
            title="Comments / Commit"
            value={(receivedTotals.commentsTotal / authoredTotals.commits).toFixed(1)}
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

      <RepositoriesContributionPanel user={user} />

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
