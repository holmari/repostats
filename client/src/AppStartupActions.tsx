import React, {useEffect} from 'react';
import {get} from './repos/requests';
import {useRootState} from './state';

const AppStartupActions: React.FC<object> = () => {
  const [, dispatch] = useRootState();

  // load the OAuth token from GITHUB_TOKEN env var for development convenience
  useEffect(() => {
    get('github/token').then((response) => {
      dispatch({type: 'setOAuthToken', token: response.token});
    });

    get('repos').then((repos) => dispatch({type: 'setRepos', repos}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return null;
};

export default AppStartupActions;
