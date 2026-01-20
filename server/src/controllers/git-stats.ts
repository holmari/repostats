import {Response, Request} from 'express';
import {spawnSync} from 'child_process';
import fs from 'fs';

import {getGitClonePath} from '../file/paths';
import {CachePath, readFromCache, writeToCache, getCacheFilename} from '../cache/cache';
import {deletePath} from '../file/paths';

interface FileStats {
  readonly path: string;
  readonly linesChanged: number;
}

function getTopChangedFilesCacheKey(repoName: string): string {
  return `top-changed-files-${repoName}`;
}

function computeTopChangedFilesForRepo(repoName: string): FileStats[] {
  const repoPath = getGitClonePath(repoName);

  if (!fs.existsSync(repoPath) || !fs.existsSync(`${repoPath}/.git`)) {
    return [];
  }

  // Run git log with numstat to get per-file line changes
  const result = spawnSync(
    'git',
    ['log', '--numstat', '--format=', '--all'],
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
