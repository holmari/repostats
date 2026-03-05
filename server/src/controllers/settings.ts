import {Response, Request} from 'express';
import fs from 'fs';

import {getConfigPath, getReposPath} from '../file/paths';
import {AppSettings, RepoConfig} from '../types/types';
import {readJsonFile, writeJsonToFile} from '../file/json';

function getAllRepoConfigs(): RepoConfig[] {
  const reposPath = getReposPath();
  if (!fs.existsSync(reposPath)) {
    return [];
  }
  return fs
    .readdirSync(reposPath)
    .filter((repoName) => fs.existsSync(getConfigPath(repoName)))
    .map((repoName) => readJsonFile<RepoConfig>(getConfigPath(repoName)));
}

export function getSettings(): AppSettings {
  const configs = getAllRepoConfigs();

  const excludedUserIds = [
    ...new Set(configs.flatMap((c) => c.excludedUserIds || [])),
  ];
  const excludedTeamSlugs = [
    ...new Set(configs.flatMap((c) => c.excludedTeamSlugs || [])),
  ];
  const excludedLabelNames = [
    ...new Set(configs.flatMap((c) => c.excludedLabelNames || [])),
  ];
  const activeSSHKeyId = configs.find((c) => c.activeSSHKeyId)?.activeSSHKeyId;

  return {
    excludedUserIds,
    excludedTeamSlugs,
    excludedLabelNames,
    activeSSHKeyId,
  };
}

export function getSettingsHandler(_req: Request, res: Response): void {
  res.json(getSettings());
}

export function saveSettingsHandler(req: Request, res: Response): void {
  const reposPath = getReposPath();
  if (!fs.existsSync(reposPath)) {
    res.json(getSettings());
    return;
  }

  const repoNames = fs
    .readdirSync(reposPath)
    .filter((repoName) => fs.existsSync(getConfigPath(repoName)));

  for (const repoName of repoNames) {
    const configPath = getConfigPath(repoName);
    const config = readJsonFile<RepoConfig>(configPath);
    const updated: RepoConfig = {
      ...config,
      ...('excludedUserIds' in req.body ? {excludedUserIds: req.body.excludedUserIds} : {}),
      ...('excludedTeamSlugs' in req.body ? {excludedTeamSlugs: req.body.excludedTeamSlugs} : {}),
      ...('excludedLabelNames' in req.body ? {excludedLabelNames: req.body.excludedLabelNames} : {}),
      ...('activeSSHKeyId' in req.body ? {activeSSHKeyId: req.body.activeSSHKeyId} : {}),
    };
    writeJsonToFile(configPath, updated);
  }

  res.json(getSettings());
}
