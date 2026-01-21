import {Response, Request} from 'express';
import {spawnSync} from 'child_process';
import fs from 'fs';

import {getGitClonePath, getCachePath, deletePath} from '../file/paths';
import {CachePath, readFromCache, writeToCache, getCacheFilename} from '../cache/cache';
import {buildEmailMapping} from '../git/emailMapping';
import {getConfigFile} from '../file/repo';
import {getDefaultBranch} from '../git/utils';

interface FileStats {
  readonly path: string;
  readonly linesChanged: number;
}

export interface UserFileStats {
  readonly path: string;
  readonly linesAdded: number;
  readonly linesDeleted: number;
}

function getTopChangedFilesCacheKey(repoName: string): string {
  return `top-changed-files-${repoName}`;
}

function computeTopChangedFilesForRepo(repoName: string): FileStats[] {
  const repoPath = getGitClonePath(repoName);

  if (!fs.existsSync(repoPath) || !fs.existsSync(`${repoPath}/.git`)) {
    return [];
  }

  // Get the default branch name
  const defaultBranch = getDefaultBranch(repoPath);

  // Run git log with numstat to get per-file line changes
  const result = spawnSync(
    'git',
    ['log', '--numstat', '--format=', defaultBranch],
    {cwd: repoPath, encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024}
  );

  if (result.status !== 0) {
    return [];
  }

  // Aggregate file stats
  const fileStats: {[path: string]: number} = {};

  // Parse numstat output: each line is "insertions\tdeletions\tfilepath"
  const lines = result.stdout.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split('\t');
    if (parts.length !== 3) {
      continue;
    }

    const [insertions, deletions, filePath] = parts;

    // Skip binary files (shown as - - filename)
    if (insertions === '-' || deletions === '-') {
      continue;
    }

    const added = parseInt(insertions, 10) || 0;
    const deleted = parseInt(deletions, 10) || 0;
    const total = added + deleted;

    if (total > 0) {
      fileStats[filePath] = (fileStats[filePath] || 0) + total;
    }
  }

  // Sort by lines changed and take top 50
  return Object.entries(fileStats)
    .map(([path, linesChanged]) => ({path, linesChanged}))
    .sort((a, b) => b.linesChanged - a.linesChanged)
    .slice(0, 50);
}

export function getTopChangedFilesHandler(req: Request, res: Response): void {
  const repoName = req.params.repoName;

  if (!repoName) {
    res.status(400).json({error: 'repoName is required'});
    return;
  }

  const cacheKey = getTopChangedFilesCacheKey(repoName);

  // Check cache first
  const cached = readFromCache<FileStats[]>(cacheKey, CachePath.gitStats);
  if (cached) {
    res.json(cached);
    return;
  }

  // Compute and cache
  const result = computeTopChangedFilesForRepo(repoName);
  writeToCache(cacheKey, CachePath.gitStats, result);
  res.json(result);
}

export function invalidateTopChangedFilesCache(repoName: string): void {
  const cacheKey = getTopChangedFilesCacheKey(repoName);
  const cacheFile = getCacheFilename(cacheKey, CachePath.gitStats);
  deletePath(cacheFile);
}

function getUserFileStatsCacheKey(
  repoName: string,
  userId: string,
  excludedPaths: ReadonlyArray<string>,
  since?: string,
  until?: string
): object {
  return {
    type: 'user-file-stats',
    repoName,
    userId,
    excludedPaths,
    since,
    until,
  };
}

function computeUserFileStats(repoName: string, userId: string, since?: string, until?: string): UserFileStats[] {
  const repoPath = getGitClonePath(repoName);

  if (!fs.existsSync(repoPath) || !fs.existsSync(`${repoPath}/.git`)) {
    return [];
  }

  // Get repo config for this repo
  let repoConfig;
  try {
    repoConfig = getConfigFile(repoName);
  } catch {
    return [];
  }

  // Build email mapping and reverse it to get emails for this user
  const emailToUser = buildEmailMapping(repoConfig);
  const userEmails: string[] = [];
  const userIdLower = userId.toLowerCase();
  for (const [email, login] of emailToUser.entries()) {
    if (login.toLowerCase() === userIdLower) {
      userEmails.push(email);
    }
  }

  if (userEmails.length === 0) {
    return [];
  }

  // Get the default branch name
  const defaultBranch = getDefaultBranch(repoPath);

  // Get excluded file paths from repo config
  const excludedPaths = repoConfig.excludedFilePaths || [];

  // Run git log for each email and aggregate
  const fileStats: {[path: string]: {added: number; deleted: number}} = {};

  for (const email of userEmails) {
    // Use --no-merges to avoid double-counting changes that appear in merge commits
    const args = ['log', '--numstat', '--format=', '--no-merges', defaultBranch, `--author=${email}`];

    // Add date range filter if provided
    if (since) {
      args.push(`--since=${since}`);
    }
    if (until) {
      args.push(`--until=${until}`);
    }

    // Add pathspec exclusions if configured
    if (excludedPaths.length > 0) {
      args.push('--');
      for (const pattern of excludedPaths) {
        args.push(`:!${pattern}`);
      }
    }

    const result = spawnSync(
      'git',
      args,
      {cwd: repoPath, encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024}
    );

    if (result.status !== 0) {
      continue;
    }

    const lines = result.stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const parts = trimmed.split('\t');
      if (parts.length !== 3) {
        continue;
      }

      const [insertions, deletions, filePath] = parts;

      // Skip binary files
      if (insertions === '-' || deletions === '-') {
        continue;
      }

      const added = parseInt(insertions, 10) || 0;
      const deleted = parseInt(deletions, 10) || 0;

      if (!fileStats[filePath]) {
        fileStats[filePath] = {added: 0, deleted: 0};
      }
      fileStats[filePath].added += added;
      fileStats[filePath].deleted += deleted;
    }
  }

  // Convert to array and sort by total lines changed
  return Object.entries(fileStats)
    .map(([path, stats]) => ({
      path,
      linesAdded: stats.added,
      linesDeleted: stats.deleted,
    }))
    .sort((a, b) => (b.linesAdded + b.linesDeleted) - (a.linesAdded + a.linesDeleted));
}

export function getUserFileStatsHandler(req: Request, res: Response): void {
  const {repoName, userId} = req.params;
  const since = req.query.since as string | undefined;
  const until = req.query.until as string | undefined;

  if (!repoName || !userId) {
    res.status(400).json({error: 'repoName and userId are required'});
    return;
  }

  // Get excluded paths from repo config for cache key
  let excludedPaths: ReadonlyArray<string> = [];
  try {
    const repoConfig = getConfigFile(repoName);
    excludedPaths = repoConfig.excludedFilePaths || [];
  } catch {
    // Ignore - will use empty exclusions
  }

  const cacheKey = getUserFileStatsCacheKey(repoName, userId, excludedPaths, since, until);

  // Check cache first
  const cached = readFromCache<UserFileStats[]>(cacheKey, CachePath.gitStats);
  if (cached) {
    res.json(cached);
    return;
  }

  // Compute and cache
  const result = computeUserFileStats(repoName, userId, since, until);
  writeToCache(cacheKey, CachePath.gitStats, result);
  res.json(result);
}

export function invalidateUserFileStatsCache(repoName: string): void {
  // Invalidate all user file stats for this repo by pattern matching cache files
  const cacheDir = `${getCachePath()}/${CachePath.gitStats}`;
  if (!fs.existsSync(cacheDir)) {
    return;
  }

  const prefix = `user-file-stats-${repoName}-`;
  const files = fs.readdirSync(cacheDir);
  for (const file of files) {
    if (file.startsWith(prefix)) {
      fs.unlinkSync(`${cacheDir}/${file}`);
    }
  }
}
