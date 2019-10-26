import './ReposPage.css';

import classNames from 'classnames';
import * as History from 'history';
import React, {useState, useEffect, useCallback} from 'react';
import {NavLink, Route, Switch} from 'react-router-dom';
import {match as RouterMatch, Redirect} from 'react-router-dom';

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

interface SelectedRepoMatch {
  readonly new?: string;
  readonly selectedRepo: string;
}

const RepoItem: React.FC<RepoItemProps> = ({className, item}) => {
  return (
    <NavLink
      className={classNames('RepoItem', className)}
      activeClassName="SidebarList__item--selected"
      to={`/settings/repos/${item.name}`}
    >
      {item.name}
    </NavLink>
  );
};
type RepoItemProps = SidebarItemRendererProps<RepoConfig>;

const ReposListPage: React.FC<Props> = ({history, match}) => {
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
      history.replace(`/settings/repos`);
      put('repos', config)
        .then((savedRepo) => {
          get('repos')
            .then((repos) => {
              dispatch({type: 'setRepos', repos});
              history.push(`/settings/repos/${savedRepo.name}`);
            })
            .catch(setError);
        })
        .catch(setError);
    },
    [dispatch, history, setError]
  );

  const closeDialog = useCallback(() => {
    history.replace('/settings/repos');
  }, [history]);

  const newRepoPageRenderer = useCallback(
    () => (
      <RepoSettingsModal
        repo={newRepo}
        isDialogOpen
        isNew
        onClose={closeDialog}
        onChange={setNewRepo}
        onSave={handleAddRepo}
      />
    ),
    [closeDialog, handleAddRepo, newRepo]
  );

  const repos = state.repos.repos;
  const selectedRepo = repos.find((repo) => repo.name === match.params.selectedRepo);
  if (!selectedRepo && repos.length) {
    return <Redirect to={`/settings/repos/${repos[0].name}`} />;
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
      <Switch>
        <Route path="/settings/repos/:selectedRepo/new" render={newRepoPageRenderer} />
      </Switch>
    </ErrorWrapper>
  );
};
interface Props {
  history: History.History;
  match: RouterMatch<SelectedRepoMatch>;
}
export default ReposListPage;
