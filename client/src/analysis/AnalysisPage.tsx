import './AnalysisPage.css';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Outlet, useLocation} from 'react-router';

import ErrorWrapper from 'components/ErrorWrapper';
import {cacheOff, get, post} from 'repos/requests';
import {RequestStatus} from 'requests/types';
import {AnalyzeResult, AppSettings, DateInterval, TeamInfo} from 'types/types';
import EmptyContentView from 'components/EmptyContentView';
import PageTopBar from 'components/PageTopBar';
import DateIntervalPicker, {ALL_TIME_INTERVAL} from 'components/DateIntervalPicker';
import CenteredSpinner from 'components/CenteredSpinner';
import RepositoryPicker from 'components/RepositoryPicker';
import {useRootState} from 'state';
import {getCookieAsJson, writeCookieFromJson} from 'cookies/utils';

export interface AnalysisOutletContext {
  result: AnalyzeResult;
  teams: ReadonlyArray<TeamInfo>;
  excludedUserIds: ReadonlyArray<string>;
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
  const [allTeams, setAllTeams] = useState<ReadonlyArray<TeamInfo>>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Track the settings that were used for the last analysis to detect changes
  const lastUsedSettingsJson = useRef<string | null>(null);

  // Filter out excluded teams
  const teams = allTeams.filter(
    (team) => !settings?.excludedTeamSlugs.includes(team.slug)
  );

  const [state] = useRootState();
  const location = useLocation();
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

  // Fetch settings on mount and when returning to analysis routes
  useEffect(() => {
    if (!location.pathname.startsWith('/analysis')) {
      return;
    }
    get('settings').then((fetchedSettings) => {
      const settingsJson = JSON.stringify(fetchedSettings);
      // If settings changed since last analysis, trigger a new one
      if (lastUsedSettingsJson.current !== null && lastUsedSettingsJson.current !== settingsJson) {
        setStatus(RequestStatus.UNSTARTED);
      }
      setSettings(fetchedSettings);
    });
  }, [location.pathname]);

  useEffect(() => {
    if (status !== RequestStatus.UNSTARTED || !settings) {
      return;
    }

    const headers = previousError ? cacheOff : {};
    setStatus(RequestStatus.IN_PROGRESS);
    lastUsedSettingsJson.current = JSON.stringify(settings);

    Promise.all([
      post('analyze', {dateInterval, includedRepoNames, excludedUserIds: settings.excludedUserIds}, headers),
      get('teams'),
    ])
      .then(([fetchedResult, fetchedTeams]) => {
        setStatus(RequestStatus.SUCCESS);
        setPreviousError(undefined);
        setResult(fetchedResult);
        setAllTeams(fetchedTeams);
      })
      .catch(setError);
  }, [dateInterval, includedRepoNames, previousError, settings, status]);

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
        <Outlet context={{ result, teams, excludedUserIds: settings?.excludedUserIds ?? [] } satisfies AnalysisOutletContext} />
      ) : (
        <EmptyContentView />
      )}
    </ErrorWrapper>
  );
};
AnalysisPage.displayName = 'AnalysisPage';

export default AnalysisPage;
