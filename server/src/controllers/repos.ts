import {Response, Request} from 'express';

import fs from 'fs';
import {
  getReposPath,
  getConfigPath,
  ensureRepoPaths,
  getRepoPath,
  deletePath,
  ensurePaths,
} from '../file/paths';
import {DownloadRequest, GithubConnector, RepoConfig} from '../types/types';
import {stringifyJson} from '../file/json';
import {getConfigFile, getSourceDataMetadata} from '../file/repo';
import {getRepoGithubSlug} from './github/utils';
import {
  getGithubCommitsForPullRequests,
  getGithubPullRequests,
  getGitHubRateLimitedHttpClient,
  getGithubRepoComments,
  getGithubReviewsForPullRequests,
  getGithubTeamsAndMembers,
} from './github';
import {ensureGithubPaths} from './github/paths';
import {clearCache} from '../cache/cache';
import {getDownloadStatus, updateDownloadStatus} from './utils';
import {DownloadContext} from '../types/download';

function error(message: string): {readonly message: string} {
  return {message}; // always json
}

export function get(_: Request, res: Response): void {
  ensurePaths();

  const reposPath = getReposPath();
  const allRepoDirs = fs.readdirSync(reposPath);

  const metadata = allRepoDirs
    .filter((repoName) => fs.existsSync(getConfigPath(repoName)))
    .map((repoName) => getConfigFile(repoName));
  res.json(metadata);
}

export function getRepoSlug(repoConfig: RepoConfig): string {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return getRepoGithubSlug(repoConfig);
    default:
      throw new Error(`Unsupported connector type ${repoConfig.connector.type}`);
  }
}

function ensureConnectorPaths(repoConfig: RepoConfig): void {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return ensureGithubPaths(repoConfig);
    default:
      throw new Error(`Unsupported connector type ${repoConfig.connector.type}`);
  }
}

export function saveRepo(req: Request, res: Response): void {
  const config: RepoConfig = {
    ...req.body,
    name: getRepoSlug(req.body),
  };

  if (!config.name.match(/^[a-z0-9-]+$/)) {
    res
      .status(400)
      .send(error(`The project name must be alphanumeric and all lowercase, was ${config.name}`));
    return;
  }

  ensureRepoPaths(config.name);
  ensureConnectorPaths(config);

  fs.writeFileSync(getConfigPath(config.name), stringifyJson(config), 'utf-8');

  res.status(200).send(config);
}

export function deleteRepo(req: Request, res: Response): void {
  const repoNameToDelete: string = req.params.repoName;

  deletePath(getRepoPath(repoNameToDelete));

  clearCache();

  res.status(200).send({repoName: repoNameToDelete});
}

async function fetchWitGithubConnector(
  repoConfig: RepoConfig<GithubConnector>,
  request: DownloadRequest
): Promise<void> {
  ensureGithubPaths(repoConfig);

  const http = await getGitHubRateLimitedHttpClient(repoConfig);
  const context: DownloadContext = {
    http,
    repoConfig,
    request,
  };

  const fetchedPullNumbers = await getGithubPullRequests(context);

  await Promise.all([
    getGithubRepoComments(context),
    getGithubTeamsAndMembers(context),
    getGithubReviewsForPullRequests(context, fetchedPullNumbers),
    getGithubCommitsForPullRequests(context, fetchedPullNumbers),
  ]);
}

async function fetchWithConnector(repoConfig: RepoConfig, request: DownloadRequest): Promise<void> {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      await fetchWitGithubConnector(repoConfig as RepoConfig<GithubConnector>, request);
      return;
    default:
      throw new Error(`Unsupported connector ${repoConfig.connector.type}`);
  }
}

export function getRepoMetadata(req: Request, res: Response): void {
  const repoConfig = getConfigFile(req.params.repoName);
  const metadata = getSourceDataMetadata(repoConfig);

  res.json(metadata);
}

export async function startDownload(req: Request, res: Response): Promise<void> {
  const downloadRequest: DownloadRequest = req.body;

  updateDownloadStatus(downloadRequest, {startedAt: new Date().toISOString()});

  const repoConfig = getConfigFile(req.params.repoName);
  await fetchWithConnector(repoConfig, downloadRequest);

  clearCache();

  getRepoMetadata(req, res);
}

export async function downloadStatus(req: Request, res: Response): Promise<void> {
  const status = getDownloadStatus(req.params.requestId);

  res.json(status);
}
