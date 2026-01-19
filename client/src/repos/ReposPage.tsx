import './ReposPage.css';

import classNames from 'classnames';
import React, {useState, useEffect, useCallback} from 'react';
import {NavLink, Navigate, useNavigate, useParams} from 'react-router';

import SidebarList, {SidebarItemRendererProps} from 'components/SidebarList';
import CenteredSpinner from 'components/CenteredSpinner';
import {RepoConfig} from 'types/types';
import ErrorWrapper from 'components/ErrorWrapper';
import EmptyContentView from 'components/EmptyContentView';

import {get, put} from './requests';
import RepoSettingsModal from './RepoSettingsModal';
import RepoPage from './RepoPage';
import {useRootState} from '../state';
import {RequestStatus} from 'requests/types';

const defaultRepoConfig: RepoConfig = {
  name: '',
  url: '',
  connector: {
    type: 'GITHUB',
    token: '',
  },
};

const RepoItem: React.FC<RepoItemProps> = ({className, item}) => {
  return (
    <NavLink
      className={({isActive}) => classNames('RepoItem', className, isActive && 'SidebarList__item--selected')}
      to={`/settings/repos/${item.name}`}
    >
      {item.name}
    </NavLink>
  );
};
type RepoItemProps = SidebarItemRendererProps<RepoConfig>;

const ReposListPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();

  const [newRepo, setNewRepo] = useState(defaultRepoConfig);
  const [error, setError] = useState(undefined);
  const clearError = useCallback(() => setError(undefined), [setError]);
  const [status, setStatus] = useState(RequestStatus.UNSTARTED);

  const [state, dispatch] = useRootState();

  useEffect(() => {
    setStatus(RequestStatus.IN_PROGRESS);
    get('repos')
      .then((repos) => {
        setStatus(RequestStatus.SUCCESS);
        dispatch({type: 'setRepos', repos});
      })
      .catch((e) => {
        setError(e);
        setStatus(RequestStatus.FAILURE);
      });
  }, [dispatch]);

  const handleAddRepo = useCallback(
    (config: RepoConfig) => {
      navigate(`/settings/repos`, {replace: true});
      put('repos', config)
        .then((savedRepo) => {
          get('repos')
            .then((repos) => {
              dispatch({type: 'setRepos', repos});
              navigate(`/settings/repos/${savedRepo.name}`);
            })
            .catch(setError);
        })
        .catch(setError);
    },
    [dispatch, navigate, setError]
  );

  const closeDialog = useCallback(() => {
    navigate('/settings/repos', {replace: true});
  }, [navigate]);

  const isAddDialogOpen = params.add === 'new';

  const repos = state.repos.repos;
  const selectedRepo = repos.find((repo) => repo.name === params.selectedRepo);
  if (!selectedRepo && repos.length && status === RequestStatus.SUCCESS) {
    return <Navigate to={`/settings/repos/${repos[0].name}`} replace />;
  }

  return (
    <ErrorWrapper className="ReposPage" error={error} onClear={clearError}>
      <div className="ReposPage__content">
        {status === RequestStatus.SUCCESS ? (
          <>
            {repos.length > 0 && (
              <SidebarList
                addLink={
                  selectedRepo
                    ? `/settings/repos/${selectedRepo.name}/new`
                    : `/settings/repos/repo/new`
                }
                items={repos}
                itemRenderer={RepoItem}
              />
            )}
            <div className="ReposPage__content--selected">
              {selectedRepo ? <RepoPage repoName={selectedRepo.name} /> : <EmptyContentView />}
            </div>
          </>
        ) : (
          <CenteredSpinner />
        )}
      </div>
      {isAddDialogOpen && (
        <RepoSettingsModal
          repo={newRepo}
          isDialogOpen
          isNew
          onClose={closeDialog}
          onChange={setNewRepo}
          onSave={handleAddRepo}
        />
      )}
    </ErrorWrapper>
  );
};

export default ReposListPage;
