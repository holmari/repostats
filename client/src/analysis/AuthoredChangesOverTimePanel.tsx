import React, {useMemo} from 'react';

import Panel from 'components/Panel';
import {UserResult} from 'types/types';

import TimeSeriesChart from './chart/TimeSeriesChart';
import {accumulate} from './chart/utils';
import {ChartDataSeries, DateValue} from './chart/types';

function toDailyData(user: UserResult): ReadonlyArray<ChartDataSeries> {
  const commitsAuthoredSeries: DateValue[] = [];
  const changesAuthoredSeries: DateValue[] = [];
  const commentsReceivedSeries: DateValue[] = [];

  user.timeSeries.forEach((activity) => {
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

const AuthoredChangesOverTimePanel: React.FC<Props> = ({user}) => {
  const data = useMemo(() => toDailyData(user), [user]);
  return (
    <Panel title="Authored changes over time" size="flex">
      {data.length ? (
        <TimeSeriesChart data={data} />
      ) : (
        <span>This user has not authored any changes.</span>
      )}
    </Panel>
  );
};
AuthoredChangesOverTimePanel.displayName = 'AuthoredChangesOverTimePanel';

interface Props {
  user: UserResult;
}

export default AuthoredChangesOverTimePanel;
