import reposReducer, {RepoAction, ReposState} from './repos';
import githubReducer, {GithubAction, GithubState} from './github';

export type Actions = GithubAction | RepoAction;
export interface RootState {
  github: GithubState;
  repos: ReposState;
}

const defaultState = {
  github: githubReducer(),
  repos: reposReducer(),
};

function mainReducer(state: RootState = defaultState, action?: Actions) {
  return {
    github: githubReducer(state.github, action),
    repos: reposReducer(state.repos, action),
  };
}

export default mainReducer;
