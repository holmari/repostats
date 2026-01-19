import {Response, Request} from 'express';
import fs from 'fs';

import {getReposPath, getConfigPath, ensurePaths} from '../file/paths';
import {getConfigFile} from '../file/repo';
import {RepoConfig} from '../types/types';
import {getGithubPullsPath} from './github/paths';
import {PullRequest} from '../types/github';
import {readJsonFile} from '../file/json';

export interface UserInfo {
  readonly id: string;
  readonly displayName: string;
}

function getUsersForRepo(repoConfig: RepoConfig): Map<string, UserInfo> {
  if (repoConfig.connector.type !== 'GITHUB') {
    return new Map();
  }

  const pullsPath = getGithubPullsPath(repoConfig);
  if (!fs.existsSync(pullsPath)) {
    return new Map();
  }

  const users = new Map<string, UserInfo>();
  const pullFiles = fs.readdirSync(pullsPath).filter((f) => f.endsWith('.json'));

  for (const pullFile of pullFiles) {
    try {
      const pull: PullRequest = readJsonFile(`${pullsPath}/${pullFile}`);
      if (pull.user) {
        users.set(pull.user.login.toLowerCase(), {
          id: pull.user.login,
          displayName: pull.user.login,
        });
      }
    } catch {
      // Skip invalid files
    }
  }

  return users;
}

export function getUsers(_req: Request, res: Response): void {
  ensurePaths();

  const reposPath = getReposPath();
  const allRepoDirs = fs.readdirSync(reposPath);

  const usersById = new Map<string, UserInfo>();

  for (const repoName of allRepoDirs) {
    if (!fs.existsSync(getConfigPath(repoName))) {
      continue;
    }

    const repoConfig = getConfigFile(repoName);
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
  res.json(users);
}
