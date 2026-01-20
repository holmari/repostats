import {DateInterval, RepoConfig} from '../types/types';
import {getGitClonePath} from '../file/paths';
import {getGitLogStats, GitLogEntry} from './operations';
import {buildEmailMapping} from './emailMapping';
import {getSSHKeyPath} from '../ssh/keys';
import {getSettings} from '../controllers/settings';

export interface UserLineStats {
  readonly linesAdded: number;
  readonly linesDeleted: number;
}

export interface RepoGitStats {
  readonly statsByUserId: {readonly [userId: string]: UserLineStats};
  readonly unmappedEmails: ReadonlyArray<string>;
  readonly lastCommitSha: string | null;
}

// Compute line stats for a repo within date interval
export async function computeRepoGitStats(
  repoConfig: RepoConfig,
  dateInterval: DateInterval | null,
  sshKeyPath: string
): Promise<RepoGitStats> {
  const repoPath = getGitClonePath(repoConfig.name);

  // Get the git log stats
  const since = dateInterval?.startDate || undefined;
  let entries: GitLogEntry[];

  try {
    entries = await getGitLogStats(repoPath, sshKeyPath, since);
  } catch (error) {
    console.error(`Failed to get git log stats for ${repoConfig.name}:`, error);
    return {
      statsByUserId: {},
      unmappedEmails: [],
      lastCommitSha: null,
    };
  }

  // Filter by date interval if provided
  if (dateInterval) {
    const startDate = new Date(dateInterval.startDate);
    const endDate = new Date(dateInterval.endDate);

    entries = entries.filter((entry) => {
      const commitDate = new Date(entry.date);
      return commitDate >= startDate && commitDate <= endDate;
    });
  }

  // Build email mapping from existing commit data
  const emailMapping = buildEmailMapping(repoConfig);

  // Aggregate stats by user
  const statsByUserId: {[userId: string]: {linesAdded: number; linesDeleted: number}} = {};
  const unmappedEmailsSet = new Set<string>();

  for (const entry of entries) {
    const userId = emailMapping.get(entry.authorEmail);

    if (!userId) {
      if (entry.authorEmail) {
        unmappedEmailsSet.add(entry.authorEmail);
      }
      continue;
    }

    if (!statsByUserId[userId]) {
      statsByUserId[userId] = {linesAdded: 0, linesDeleted: 0};
    }

    statsByUserId[userId].linesAdded += entry.insertions;
    statsByUserId[userId].linesDeleted += entry.deletions;
  }

  // Find the last commit SHA
  const lastCommitSha = entries.length > 0 ? entries[0].sha : null;

  return {
    statsByUserId,
    unmappedEmails: Array.from(unmappedEmailsSet),
    lastCommitSha,
  };
}

// Get git stats for a repo, using cached SSH key settings
export async function getRepoGitStats(
  repoConfig: RepoConfig,
  dateInterval: DateInterval | null
): Promise<RepoGitStats | null> {
  const settings = getSettings();
  const activeKeyId = settings.activeSSHKeyId;

  if (!activeKeyId) {
    return null;
  }

  const keyPath = getSSHKeyPath(activeKeyId);
  if (!keyPath) {
    return null;
  }

  return computeRepoGitStats(repoConfig, dateInterval, keyPath);
}
