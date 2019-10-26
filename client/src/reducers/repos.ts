import {replaceAt} from 'arrays/utils';
import {Actions} from '.';
import {RepoConfig, RepoSourceDataMetadata} from '../types/types';

export interface ReposState {
  readonly repos: ReadonlyArray<RepoConfig>;
  readonly sourceDataMetadata: {readonly [repoName: string]: RepoSourceDataMetadata};
}

export type RepoAction =
  | {type: 'setRepos'; repos: ReadonlyArray<RepoConfig>}
  | {type: 'setRepo'; repo: RepoConfig}
  | {type: 'deleteRepo'; repoName: string}
  | {
      type: 'setRepoSourceDataMetadata';
      repoName: string;
      sourceDataMetadata: RepoSourceDataMetadata;
    };

const defaultState: ReposState = {
  repos: [],
  sourceDataMetadata: {},
};

export default function reposReducer(state: ReposState = defaultState, action?: Actions) {
  switch (action?.type) {
    case 'setRepos':
      return {...state, repos: action.repos};
    case 'setRepo':
      const index = state.repos.findIndex((repo) => repo.name === action.repo.name);
      return {...state, repos: replaceAt(state.repos, index, action.repo)};
    case 'deleteRepo':
      return {...state, repos: state.repos.filter((repo) => repo.name !== action.repoName)};
    case 'setRepoSourceDataMetadata':
      return {
        ...state,
        sourceDataMetadata: {
          ...state.sourceDataMetadata,
          [action.repoName]: action.sourceDataMetadata,
        },
      };
    default:
      return state;
  }
}
