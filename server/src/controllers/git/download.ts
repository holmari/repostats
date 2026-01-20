import {RepoConfig} from '../../types/types';
import {getGitClonePath, ensurePathExists, getGitClonesPath} from '../../file/paths';
import {cloneOrFetchRepo} from '../../git/operations';
import {httpsToSshUrl} from '../../git/utils';

export async function fetchGitRepo(
  repoConfig: RepoConfig,
  sshKeyPath: string
): Promise<void> {
  // Ensure git clones directory exists
  ensurePathExists(getGitClonesPath());

  const repoPath = getGitClonePath(repoConfig.name);
  const sshUrl = httpsToSshUrl(repoConfig.url);

  console.log(`Cloning/fetching repo ${repoConfig.name} to ${repoPath}`);

  await cloneOrFetchRepo(sshUrl, repoPath, sshKeyPath);

  console.log(`Completed git clone/fetch for ${repoConfig.name}`);
}
