import './AnalysisPage.css';

import React, {useCallback, useEffect, useState} from 'react';
import {StaticContext} from 'react-router';
import {Switch, Route, RouteComponentProps} from 'react-router-dom';

import ErrorWrapper from 'components/ErrorWrapper';
import {cacheOff, post} from 'repos/requests';
import {RequestStatus} from 'requests/types';
import {AnalyzeResult, DateInterval} from 'types/types';
import EmptyContentView from 'components/EmptyContentView';
import PageTopBar from 'components/PageTopBar';
import DateIntervalPicker from 'components/DateIntervalPicker';
import CenteredSpinner from 'components/CenteredSpinner';
import RepositoryPicker from 'components/RepositoryPicker';
import {useRootState} from 'state';

import AnalysisPerUserPage from './AnalysisPerUserPage';
import AnalysisTeamGraphPage from './AnalysisTeamGraphPage';
import AllUsersOverviewPage from './AllUsersOverviewPage';

export const ALL_TIME_INTERVAL: DateInterval = {
  startDate: new Date(0).toISOString(),
  endDate: new Date('2100-01-01').toISOString(),
};

const AnalysisPage: React.FC<Props> = () => {
  const [status, setStatus] = useState(RequestStatus.UNSTARTED);
  const [includedRepoNames, setIncludedRepoNames] = useState<ReadonlyArray<string> | undefined>(
    undefined
  );
  const [dateInterval, setDateInterval] = useState<DateInterval>(ALL_TIME_INTERVAL);
  const [error, setError] = useState(undefined);
  const [previousError, setPreviousError] = useState(undefined);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const [state] = useRootState();
  const allRepoNames: ReadonlyArray<string> = state.repos.repos.map(
    (repoConfig) => repoConfig.name
  );

  const changeDateInterval = (interval: DateInterval) => {
    setDateInterval(interval);
    setStatus(RequestStatus.UNSTARTED);
  };

  const changeIncludedRepoNames = (repoNames: ReadonlyArray<string>) => {
    setIncludedRepoNames(repoNames);
    setStatus(RequestStatus.UNSTARTED);
  };

  const clearError = useCallback(() => {
    setStatus(RequestStatus.UNSTARTED);
    setPreviousError(error);
    setError(undefined);
  }, [error, setError]);

  useEffect(() => {
    if (status !== RequestStatus.UNSTARTED) {
      return;
    }

    const headers = previousError ? cacheOff : {};
    setStatus(RequestStatus.IN_PROGRESS);
    post('analyze', {dateInterval, includedRepoNames}, headers)
      .then((fetchedResult) => {
        setStatus(RequestStatus.SUCCESS);
        setPreviousError(undefined);
        setResult(fetchedResult);
      })
      .catch(setError);
  }, [dateInterval, includedRepoNames, previousError, status]);

  const topBarLeftContent = (
    <>
      <DateIntervalPicker interval={dateInterval} onChange={changeDateInterval} />
      <RepositoryPicker
        availableRepositories={allRepoNames}
        selectedRepositories={includedRepoNames}
        onChange={changeIncludedRepoNames}
      />
    </>
  );

  const perUserPageRenderer = useCallback(
    (props: RouteComponentProps<any, StaticContext, unknown>) =>
      result && <AnalysisPerUserPage match={props.match} result={result} />,
    [result]
  );

  const teamGraphPageRenderer = useCallback(
    () => result && <AnalysisTeamGraphPage result={result} />,
    [result]
  );

  const allUsersOverviewPageRenderer = useCallback(
    () => result && <AllUsersOverviewPage result={result} />,
    [result]
  );

  const hasUserResults = Object.keys(result?.userResults || {}).length > 0;

  return (
    <ErrorWrapper className="AnalysisPage" error={error} onClear={clearError}>
      <PageTopBar leftContent={topBarLeftContent} />
      {status === RequestStatus.IN_PROGRESS || status === RequestStatus.UNSTARTED || !result ? (
        <CenteredSpinner />
      ) : hasUserResults ? (
        <Switch>
          <Route path="/analysis/people/:userId?" render={perUserPageRenderer} />
          <Route path="/analysis/team-graph" render={teamGraphPageRenderer} />
          <Route path="/analysis/overview" render={allUsersOverviewPageRenderer} />
        </Switch>
      ) : (
        <EmptyContentView />
      )}
    </ErrorWrapper>
  );
};
AnalysisPage.displayName = 'AnalysisPage';

interface Props {}

export default AnalysisPage;
