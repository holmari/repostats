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
