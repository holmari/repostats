import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import {UserResult} from 'types/types';

import TimeSeriesChart from './chart/TimeSeriesChart';
import {ChartDataSeries, DateValue} from './chart/types';
import {accumulate} from './chart/utils';

function toDailyData(user: UserResult): ReadonlyArray<ChartDataSeries> {
  const commentsAuthoredSeries: DateValue[] = [];
  const approvalsGivenSeries: DateValue[] = [];
  const rejectionsGivenSeries: DateValue[] = [];

  user.timeSeries.forEach((activity) => {
    commentsAuthoredSeries.push({date: new Date(activity.date), value: activity.commentsAuthored});
    approvalsGivenSeries.push({
      date: new Date(activity.date),
      value: activity.reviewsAuthored.approvals,
    });
    rejectionsGivenSeries.push({
      date: new Date(activity.date),
      value: activity.reviewsAuthored.rejections,
    });
  });

  return [
    {label: 'Comments Authored', color: '#4a91ff', series: accumulate(commentsAuthoredSeries)},
    {label: 'Approvals Given', color: '#ff8270', series: accumulate(approvalsGivenSeries)},
    {label: 'Rejections Given', color: '#a3cc27', series: accumulate(rejectionsGivenSeries)},
  ];
}

const ReviewedChangesOverTimePanel: React.FC<Props> = ({user}) => {
  const data = useMemo(() => toDailyData(user), [user]);
  return (
    <Panel title="Reviewed changes over time" size="flex">
      {data.length ? (
        <TimeSeriesChart data={data} />
      ) : (
        <span>This user has not reviewed any changes.</span>
      )}
    </Panel>
  );
};
ReviewedChangesOverTimePanel.displayName = 'ReviewedChangesOverTimePanel';

interface Props {
  user: UserResult;
}

export default ReviewedChangesOverTimePanel;
