import './AnalysisPage.css';

import React, {useCallback, useEffect, useState} from 'react';
import {Outlet} from 'react-router';

import ErrorWrapper from 'components/ErrorWrapper';
import {cacheOff, post} from 'repos/requests';
import {RequestStatus} from 'requests/types';
import {AnalyzeResult, DateInterval} from 'types/types';
import EmptyContentView from 'components/EmptyContentView';
import PageTopBar from 'components/PageTopBar';
import DateIntervalPicker, {ALL_TIME_INTERVAL} from 'components/DateIntervalPicker';
import CenteredSpinner from 'components/CenteredSpinner';
import RepositoryPicker from 'components/RepositoryPicker';
import {useRootState} from 'state';
import {getCookieAsJson, writeCookieFromJson} from 'cookies/utils';

export interface AnalysisOutletContext {
  result: AnalyzeResult;
}

const AnalysisPage: React.FC = () => {
  const [status, setStatus] = useState(RequestStatus.UNSTARTED);
  const [includedRepoNames, setIncludedRepoNames] = useState<ReadonlyArray<string> | undefined>(
    getCookieAsJson('includedRepoNames')
  );
  const [dateInterval, setDateInterval] = useState<DateInterval>(
    getCookieAsJson('dateInterval') || ALL_TIME_INTERVAL
  );
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
    writeCookieFromJson('dateInterval', interval);
  };

  const changeIncludedRepoNames = (repoNames: ReadonlyArray<string>) => {
    setIncludedRepoNames(repoNames);
    setStatus(RequestStatus.UNSTARTED);
    writeCookieFromJson('includedRepoNames', repoNames);
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

  const hasUserResults = Object.keys(result?.userResults || {}).length > 0;

  return (
    <ErrorWrapper className="AnalysisPage" error={error} onClear={clearError}>
      <PageTopBar leftContent={topBarLeftContent} />
      {status === RequestStatus.IN_PROGRESS || status === RequestStatus.UNSTARTED || !result ? (
        <CenteredSpinner />
      ) : hasUserResults ? (
        <Outlet context={{ result } satisfies AnalysisOutletContext} />
      ) : (
        <EmptyContentView />
      )}
    </ErrorWrapper>
  );
};
AnalysisPage.displayName = 'AnalysisPage';

export default AnalysisPage;
