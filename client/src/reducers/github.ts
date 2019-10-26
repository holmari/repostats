import {Actions} from '.';

export interface GithubState {
  readonly oauthToken: string | undefined;
}

export type GithubAction = {type: 'setOAuthToken'; token: string};

const defaultState: GithubState = {
  oauthToken: undefined,
};

export default function githubReducer(state: GithubState = defaultState, action?: Actions) {
  switch (action?.type) {
    case 'setOAuthToken':
      return {...state, oauthToken: action.token};
    default:
      return state;
  }
}
