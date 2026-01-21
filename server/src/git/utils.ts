import {spawnSync} from 'child_process';

// Get the default branch name for a git repository
export function getDefaultBranch(repoPath: string): string {
  // Try to get the default branch from origin/HEAD
  const result = spawnSync(
    'git',
    ['symbolic-ref', 'refs/remotes/origin/HEAD'],
    {cwd: repoPath, encoding: 'utf-8'}
  );

  if (result.status === 0 && result.stdout.trim()) {
    // Output is like "refs/remotes/origin/main" - extract just the branch name
    const ref = result.stdout.trim();
    const match = ref.match(/refs\/remotes\/origin\/(.+)/);
    if (match) {
      return match[1];
    }
  }

  // Fallback: try common default branch names
  for (const branch of ['main', 'master', 'trunk']) {
    const checkResult = spawnSync(
      'git',
      ['rev-parse', '--verify', branch],
      {cwd: repoPath, encoding: 'utf-8'}
    );
    if (checkResult.status === 0) {
      return branch;
    }
  }

  // Last resort: use HEAD
  return 'HEAD';
}

// Convert https://github.com/owner/repo to git@github.com:owner/repo.git
export function httpsToSshUrl(httpsUrl: string): string {
  // Handle various GitHub URL formats
  const patterns = [
    // https://github.com/owner/repo
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/,
    // github.com/owner/repo
    /^github\.com\/([^/]+)\/([^/]+?)(\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = httpsUrl.match(pattern);
    if (match) {
      const [, owner, repo] = match;
      return `git@github.com:${owner}/${repo}.git`;
    }
  }

  // If already an SSH URL, return as-is
  if (httpsUrl.startsWith('git@')) {
    return httpsUrl;
  }

  throw new Error(`Cannot convert URL to SSH format: ${httpsUrl}`);
}

// Extract owner/repo from a GitHub URL
export function extractRepoSlug(url: string): {owner: string; repo: string} {
  const patterns = [
    // git@github.com:owner/repo.git
    /^git@github\.com:([^/]+)\/([^/]+?)(\.git)?$/,
    // https://github.com/owner/repo
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/,
    // github.com/owner/repo
    /^github\.com\/([^/]+)\/([^/]+?)(\.git)?$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {owner: match[1], repo: match[2]};
    }
  }

  throw new Error(`Cannot extract repo slug from URL: ${url}`);
}
