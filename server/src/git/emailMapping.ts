import {RepoConfig} from '../types/types';
import {Commit} from '../types/github';
import {getGithubCommitsPath} from '../controllers/github/paths';
import {iterEachFile} from '../file/utils';
import fs from 'fs';

export type EmailToUserIdMapping = Map<string, string>;

// Build a mapping from email addresses to GitHub user IDs (logins)
// by iterating through the existing commit data
export function buildEmailMapping(repoConfig: RepoConfig): EmailToUserIdMapping {
  const mapping = new Map<string, string>();

  const commitsPath = getGithubCommitsPath(repoConfig);
  if (!fs.existsSync(commitsPath)) {
    return mapping;
  }

  for (const [commit] of iterEachFile<Commit>(commitsPath)) {
    // Skip commits without author information
    if (!commit.author?.login) {
      continue;
    }

    const email = commit.commit?.author?.email?.toLowerCase();
    if (!email) {
      continue;
    }

    // Skip GitHub noreply emails as they're not useful for mapping
    if (email.endsWith('users.noreply.github.com')) {
      // But we can still extract the login from some noreply formats
      // Format: 12345+username@users.noreply.github.com or username@users.noreply.github.com
      const match = email.match(/(?:\d+\+)?([^@]+)@users\.noreply\.github\.com/);
      if (match) {
        const extractedLogin = match[1].toLowerCase();
        // Only map if it matches the author login (to avoid mismatches)
        if (extractedLogin === commit.author.login.toLowerCase()) {
          mapping.set(email, commit.author.login);
        }
      }
      continue;
    }

    // Map the email to the GitHub login
    mapping.set(email, commit.author.login);
  }

  return mapping;
}
