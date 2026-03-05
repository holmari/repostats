import {GithubConnector, RepoConfig} from '../../types/types';
import {getGitClonePath, ensurePathExists, getGitClonesPath} from '../../file/paths';
import {cloneOrFetchRepo, GitAuth} from '../../git/operations';
import {httpsToSshUrl} from '../../git/utils';

export async function fetchGitRepo(
  repoConfig: RepoConfig<GithubConnector>,
  sshKeyPath?: string
): Promise<void> {
  // Ensure git clones directory exists
  ensurePathExists(getGitClonesPath());

  const repoPath = getGitClonePath(repoConfig.name);

  let auth: GitAuth;
  let repoUrl: string;

  if (sshKeyPath) {
    auth = {type: 'ssh', credential: sshKeyPath};
    repoUrl = httpsToSshUrl(repoConfig.url);
  } else {
    auth = {type: 'token', credential: repoConfig.connector.token};
    repoUrl = repoConfig.url;
  }

  console.log(`Cloning/fetching repo ${repoConfig.name} to ${repoPath}`);

  await cloneOrFetchRepo(repoUrl, repoPath, auth);

  console.log(`Completed git clone/fetch for ${repoConfig.name}`);
}
