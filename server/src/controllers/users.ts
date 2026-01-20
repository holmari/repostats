import {Response, Request} from 'express';
import fs from 'fs';

import {getReposPath, getConfigPath, ensurePaths} from '../file/paths';
import {getConfigFile} from '../file/repo';
import {GithubSourceDataMetadata, RepoConfig} from '../types/types';
import {
  getGithubCommentsPath,
  getGithubCommitsPath,
  getGithubMetadataPath,
  getGithubPullsPath,
  getGithubReviewsPath,
} from './github/paths';
import {Comment, Commit, PullRequest, Review} from '../types/github';
import {readJsonFile} from '../file/json';
import {CachePath, readFromCache, writeToCache} from '../cache/cache';

export interface UserInfo {
  readonly id: string;
  readonly displayName: string;
}

interface UsersCacheEntry {
  readonly users: ReadonlyArray<UserInfo>;
}

function addUserToMap(users: Map<string, UserInfo>, login: string | undefined): void {
  if (!login) {
    return;
  }
  const key = login.toLowerCase();
  if (!users.has(key)) {
    users.set(key, {id: login, displayName: login});
  }
}

function scanUsersFromPulls(pullsPath: string, users: Map<string, UserInfo>): void {
  if (!fs.existsSync(pullsPath)) {
    return;
  }

  const pullFiles = fs.readdirSync(pullsPath).filter((f) => f.endsWith('.json'));
  for (const pullFile of pullFiles) {
    try {
      const pull: PullRequest = readJsonFile(`${pullsPath}/${pullFile}`);
      // PR author
      addUserToMap(users, pull.user?.login);
      // Requested reviewers (users asked to review but may not have acted yet)
      if (pull.requested_reviewers) {
        for (const reviewer of pull.requested_reviewers) {
          addUserToMap(users, reviewer.login);
        }
      }
    } catch {
      // Skip invalid files
    }
  }
}

function scanUsersFromReviews(reviewsPath: string, users: Map<string, UserInfo>): void {
  if (!fs.existsSync(reviewsPath)) {
    return;
  }

  const pullDirs = fs.readdirSync(reviewsPath);
  for (const pullDir of pullDirs) {
    const pullReviewsPath = `${reviewsPath}/${pullDir}`;
    if (!fs.statSync(pullReviewsPath).isDirectory()) {
      continue;
    }
    const reviewFiles = fs.readdirSync(pullReviewsPath).filter((f) => f.endsWith('.json'));
    for (const reviewFile of reviewFiles) {
      try {
        const review: Review = readJsonFile(`${pullReviewsPath}/${reviewFile}`);
        addUserToMap(users, review.user?.login);
      } catch {
        // Skip invalid files
      }
    }
  }
}

function scanUsersFromComments(commentsPath: string, users: Map<string, UserInfo>): void {
  if (!fs.existsSync(commentsPath)) {
    return;
  }

  const pullDirs = fs.readdirSync(commentsPath);
  for (const pullDir of pullDirs) {
    const pullCommentsPath = `${commentsPath}/${pullDir}`;
    if (!fs.statSync(pullCommentsPath).isDirectory()) {
      continue;
    }
    const commentFiles = fs.readdirSync(pullCommentsPath).filter((f) => f.endsWith('.json'));
    for (const commentFile of commentFiles) {
      try {
        const comment: Comment = readJsonFile(`${pullCommentsPath}/${commentFile}`);
        addUserToMap(users, comment.user?.login);
      } catch {
        // Skip invalid files
      }
    }
  }
}

function scanUsersFromCommits(commitsPath: string, users: Map<string, UserInfo>): void {
  if (!fs.existsSync(commitsPath)) {
    return;
  }

  const pullDirs = fs.readdirSync(commitsPath);
  for (const pullDir of pullDirs) {
    const pullCommitsPath = `${commitsPath}/${pullDir}`;
    if (!fs.statSync(pullCommitsPath).isDirectory()) {
      continue;
    }
    const commitFiles = fs.readdirSync(pullCommitsPath).filter((f) => f.endsWith('.json'));
    for (const commitFile of commitFiles) {
      try {
        const commit: Commit = readJsonFile(`${pullCommitsPath}/${commitFile}`);
        addUserToMap(users, commit.author?.login);
      } catch {
        // Skip invalid files
      }
    }
  }
}

function getMetadataUpdatedAt(repoConfig: RepoConfig): string | null {
  if (repoConfig.connector.type !== 'GITHUB') {
    return null;
  }
  const metaPath = getGithubMetadataPath(repoConfig);
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  try {
    const metadata: GithubSourceDataMetadata = readJsonFile(metaPath);
    return metadata.updatedAt;
  } catch {
    return null;
  }
}

function getUsersForRepo(repoConfig: RepoConfig): Map<string, UserInfo> {
  if (repoConfig.connector.type !== 'GITHUB') {
    return new Map();
  }

  const users = new Map<string, UserInfo>();

  scanUsersFromPulls(getGithubPullsPath(repoConfig), users);
  scanUsersFromReviews(getGithubReviewsPath(repoConfig), users);
  scanUsersFromComments(getGithubCommentsPath(repoConfig), users);
  scanUsersFromCommits(getGithubCommitsPath(repoConfig), users);

  return users;
}

export function getUsers(_req: Request, res: Response): void {
  ensurePaths();

  const reposPath = getReposPath();
  const allRepoDirs = fs.readdirSync(reposPath);

  // Build cache key based on all repo metadata updatedAt timestamps
  const repoConfigs: RepoConfig[] = [];
  const cacheKeyParts: Record<string, string> = {};

  for (const repoName of allRepoDirs) {
    if (!fs.existsSync(getConfigPath(repoName))) {
      continue;
    }
    const repoConfig = getConfigFile(repoName);
    repoConfigs.push(repoConfig);
    const updatedAt = getMetadataUpdatedAt(repoConfig);
    if (updatedAt) {
      cacheKeyParts[repoName] = updatedAt;
    }
  }

  // Check cache
  const cacheKey = {type: 'users', repos: cacheKeyParts};
  const cached = readFromCache<UsersCacheEntry>(cacheKey, CachePath.users);
  if (cached) {
    res.json(cached.users);
    return;
  }

  // Compute users from all sources
  const usersById = new Map<string, UserInfo>();

  for (const repoConfig of repoConfigs) {
    const repoUsers = getUsersForRepo(repoConfig);

    for (const [key, user] of repoUsers) {
      if (!usersById.has(key)) {
        usersById.set(key, user);
      }
    }
  }

  const users = Array.from(usersById.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  // Cache the result
  writeToCache(cacheKey, CachePath.users, {users});

  res.json(users);
}
