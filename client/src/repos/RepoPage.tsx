import './RepoPage.css';

import {v4 as uuid} from 'uuid';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import Button from 'react-bootstrap/Button';

import ErrorWrapper from 'components/ErrorWrapper';
import PageTopBar from 'components/PageTopBar';

import {del, get, post, put} from './requests';
import RepoSettingsModal from './RepoSettingsModal';
import {useRootState} from 'state';
import {
  ConnectorType,
  DownloadStatus,
  GithubSourceDataMetadata,
  RepoConfig,
  RepoSourceDataMetadata,
} from 'types/types';
import DeleteButton from 'components/DeleteButton';
import DownloadProgressBar from 'components/DownloadProgressBar';
import {Navigate} from 'react-router';
import {Spinner} from 'react-bootstrap';
import {RequestStatus} from 'requests/types';
import RepoSourceDataContent from './RepoSourceDataContent';
import RepoFileExclusions from './RepoFileExclusions';
import Panel from 'components/Panel';
import EmptyContentView from 'components/EmptyContentView';

function hasGithubContent(metadata: GithubSourceDataMetadata): boolean {
  return metadata.fetchedPullNumbers.length > 0 || metadata.fetchedCommentIds.length > 0;
}

function hasContent(metadata: RepoSourceDataMetadata | null): boolean {
  if (!metadata) {
    return false;
  }

  switch (metadata.type) {
    case 'GITHUB':
      return hasGithubContent(metadata);
    default:
      throw new Error(`Unsupported type ${metadata.type}`);
  }
}

function getConnectorDisplayName(connectorType: ConnectorType) {
  switch (connectorType) {
    case 'GIT':
      return 'Git';
    case 'GITHUB':
      return 'GitHub';
    default:
      throw new Error(`Unsupported connector type ${connectorType}`);
  }
}

function getDisplayStatus(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.UNSTARTED:
      return 'Unstarted';
    case RequestStatus.IN_PROGRESS:
      return 'Downloading…';
    case RequestStatus.SUCCESS:
      return 'Finished';
    case RequestStatus.FAILURE:
      return "There's a problem.";
  }
}

// Modified based on : https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback: () => void, delayMsec: number | null) {
  const savedCallback = useRef<() => void>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    if (delayMsec !== null) {
      const id = setInterval(tick, delayMsec);
      return () => clearInterval(id);
    }
    return undefined;
  }, [delayMsec]);
}

const RepoPage: React.FC<Props> = ({repoName}) => {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loadingSourceDataStatus, setLoadingSourceDataStatus] = useState(RequestStatus.UNSTARTED);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState(undefined);
  const clearError = useCallback(() => setError(undefined), [setError]);
  const [state, dispatch] = useRootState();
  const repo = state.repos.repos.find((repo) => repo.name === repoName);
  const [editingRepo, setEditingRepo] = useState(repo);

  const getSourceDataMetadata = useCallback(() => state.repos.sourceDataMetadata[repoName || ''], [
    state,
    repoName,
  ]);

  useInterval(
    () => (repo ? get(`repos/${repo.name}/${requestId}/status`).then(setDownloadStatus) : {}),
    loadingSourceDataStatus === RequestStatus.IN_PROGRESS ? 1000 : null
  );

  const startDownload = () => {
    setLoadingSourceDataStatus(RequestStatus.IN_PROGRESS);
    const requestId = uuid();
    setRequestId(requestId);
    setDownloadStatus({
      phase: 'start',
      phaseProgress: null,
      phaseErrors: {},
      fetchedResources: 0,
      rateLimit: null,
      rateLimitLeft: null,
      startedAt: new Date().toISOString(),
    });

    post(`repos/${repoName}/download`, {requestId})
      .then((sourceDataMetadata: RepoSourceDataMetadata) => {
        dispatch({type: 'setRepoSourceDataMetadata', repoName, sourceDataMetadata});
        setDownloadStatus((prev) => prev ? {...prev, phase: 'finish'} : prev);
        setLoadingSourceDataStatus(RequestStatus.SUCCESS);
      })
      .catch((e) => {
        setError(e);
        setLoadingSourceDataStatus(RequestStatus.FAILURE);
      });
  };

  const handleDelete = () => {
    del(`repos/${repoName}`).then(() => {
      dispatch({type: 'deleteRepo', repoName});
    });
  };
  const saveRepo = (proposedRepo: RepoConfig) => {
    setSettingsOpen(false);
    put('repos', proposedRepo)
      .then((savedRepo) => {
        setEditingRepo(savedRepo);
        dispatch({type: 'setRepo', repo: savedRepo});
      })
      .catch(setError);
  };

  useEffect(() => {
    if (repo && repo.name !== editingRepo?.name) {
      setEditingRepo(repo);
    }
  }, [editingRepo, repo]);

  useEffect(() => {
    if (!getSourceDataMetadata())
      get(`repos/${repoName}/meta`)
        .then((sourceDataMetadata) =>
          dispatch({type: 'setRepoSourceDataMetadata', repoName, sourceDataMetadata})
        )
        .catch(setError)
        .finally(() => setMetadataLoaded(true));
    else
      setMetadataLoaded(true);
  }, [dispatch, getSourceDataMetadata, repoName]);

  useEffect(() => {
    if (loadingSourceDataStatus !== RequestStatus.UNSTARTED) return;

    get(`repos/${repoName}/active-download`).then((result) => {
      if (result && result.requestId && result.status) {
        setRequestId(result.requestId);
        setDownloadStatus(result.status);
        setLoadingSourceDataStatus(RequestStatus.IN_PROGRESS);
      }
    });
  }, [repoName, loadingSourceDataStatus]);

  if (!repo) {
    return <Navigate to="/settings/repos" replace />;
  }

  return (
    <ErrorWrapper className="RepoPage" error={error} onClear={clearError}>
      <PageTopBar
        variant="light"
        rightContent={
          <>
            <Button onClick={() => setSettingsOpen(true)}>Settings</Button>
            <Button onClick={startDownload}>
              {loadingSourceDataStatus === RequestStatus.IN_PROGRESS ? (
                <Spinner animation="border" size="sm" />
              ) : (
                'Download source data'
              )}
            </Button>
            <DeleteButton onConfirm={handleDelete} />
          </>
        }
      />
      <div className="RepoPage__content">
        <Panel title={repo.name} size="flex">
          <fieldset>
            <legend>Type</legend>
            {getConnectorDisplayName(repo.connector.type)}
          </fieldset>
          <RepoSourceDataContent metadata={getSourceDataMetadata()} />
        </Panel>
        <Panel title="File Exclusions" size="flex" className="overflow-visible RepoPage__file-exclusions">
          <RepoFileExclusions
            repo={repo}
            onRepoChange={(updatedRepo) => dispatch({type: 'setRepo', repo: updatedRepo})}
          />
        </Panel>
        {metadataLoaded &&
          !hasContent(getSourceDataMetadata()) &&
          loadingSourceDataStatus === RequestStatus.UNSTARTED && (
            <Panel className="RepoPage__download-content" title="" size="flex">
              <EmptyContentView
                onButtonClick={startDownload}
                buttonTitle="Download source data"
                description="Start downloading data to analyze this repository."
                title="No data has been downloaded yet."
              />
            </Panel>
          )}
        {loadingSourceDataStatus !== RequestStatus.UNSTARTED && (
          <Panel className="RepoPage__download-content" title="" size="flex">
            <div className="RepoPage__download-content-progress-indicator">
              <h4>{getDisplayStatus(loadingSourceDataStatus)}</h4>
              {downloadStatus && (
                <DownloadProgressBar
                  currentPhase={downloadStatus.phase}
                  phaseProgress={downloadStatus.phaseProgress}
                  phaseErrors={downloadStatus.phaseErrors}
                />
              )}
              {!!downloadStatus && (
                <div className="RepoPage__download-stats">
                  Fetched <strong>{downloadStatus.fetchedResources}</strong> resource(s).{' '}
                  {downloadStatus.rateLimitLeft !== null &&
                    `Rate limit: ${downloadStatus.rateLimitLeft}/${downloadStatus.rateLimit}.`}
                </div>
              )}
              {loadingSourceDataStatus === RequestStatus.IN_PROGRESS && (
                <div className="RepoPage__download-hint">
                  This can take minutes or hours, depending on the size of the repository.
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
      {editingRepo ? (
        <RepoSettingsModal
          repo={editingRepo}
          isDialogOpen={isSettingsOpen}
          onClose={() => setSettingsOpen(false)}
          onChange={setEditingRepo}
          onSave={saveRepo}
        />
      ) : null}
    </ErrorWrapper>
  );
};
interface Props {
  repoName: string;
}

export default RepoPage;
