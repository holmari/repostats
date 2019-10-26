import fs from 'fs';
import path from 'path';
import slugify from 'slugify';

import {readJsonFile, writeJsonToFile} from '../../file/json';
import {getAllJsonFilenamesInDirectory} from '../../file/utils';
import {GithubConnector, GithubSourceDataMetadata, RepoConfig} from '../../types/types';
import {
  getGithubCommentsPath,
  getGithubDataPath,
  getGithubMetadataPath,
  getGithubPullsPath,
  getGithubTeamsPath,
} from './paths';

const GITHUB_URL_PREFIX = 'https://github.com/';

export const RATE_LIMIT_URL = 'https://api.github.com/rate_limit';

export function getOwnerFromUrl(repoUrl: string): string {
  if (!repoUrl.startsWith(GITHUB_URL_PREFIX)) {
    throw new Error(`Invalid Github URL: ${repoUrl}`);
  }

  return repoUrl.slice(GITHUB_URL_PREFIX.length).split('/')[0];
}

export function getRepoFromUrl(repoUrl: string): string {
  if (!repoUrl.startsWith(GITHUB_URL_PREFIX)) {
    throw new Error(`Invalid Github URL: ${repoUrl}`);
  }
  return repoUrl.slice(GITHUB_URL_PREFIX.length).split('/')[1];
}

export function repoUrl(repoConfig: RepoConfig<GithubConnector>): string {
  const owner = getOwnerFromUrl(repoConfig.url);
  const repoName = getRepoFromUrl(repoConfig.url);
  return `https://api.github.com/repos/${owner}/${repoName}`;
}

export function orgsUrl(repoConfig: RepoConfig<GithubConnector>): string {
  const orgName = getOwnerFromUrl(repoConfig.url);
  return `https://api.github.com/orgs/${orgName}`;
}

export function getRepoGithubSlug(repoConfig: RepoConfig): string {
  return slugify(
    `${getOwnerFromUrl(repoConfig.url)}-${getRepoFromUrl(repoConfig.url)}`
  ).toLocaleLowerCase();
}

export function getDownloadedPullRequestNumbers(repoConfig: RepoConfig): ReadonlyArray<number> {
  return getAllJsonFilenamesInDirectory(getGithubPullsPath(repoConfig)).map((filename) =>
    parseInt(path.basename(filename, path.extname(filename)))
  );
}

export function getDownloadedTeamSlugs(repoConfig: RepoConfig): ReadonlyArray<string> {
  return getAllJsonFilenamesInDirectory(getGithubTeamsPath(repoConfig)).map((filename) =>
    path.basename(filename, path.extname(filename))
  );
}

export function getDownloadedCommentIds(repoConfig: RepoConfig): ReadonlyArray<number> {
  return getAllJsonFilenamesInDirectory(getGithubCommentsPath(repoConfig)).map((filename) =>
    parseInt(path.basename(filename, path.extname(filename)))
  );
}

export function getDefaultGithubSourceDataMetadata(
  repoConfig: RepoConfig
): GithubSourceDataMetadata {
  return {
    fetchedCommentIds: [],
    fetchedPullNumbers: [],
    downloadsPath: getGithubDataPath(repoConfig),
    type: 'GITHUB',
    totalCommentCount: -1,
    totalPullsInRepository: -1,
    updatedAt: new Date(0).toISOString(),
  };
}

export function getGithubSourceDataMetadata(repoConfig: RepoConfig): GithubSourceDataMetadata {
  const path = getGithubMetadataPath(repoConfig);
  const metaFileContent: GithubSourceDataMetadata = readJsonFile(path);

  return {
    ...metaFileContent,
    downloadsPath: getGithubDataPath(repoConfig),
    fetchedCommentIds: getDownloadedCommentIds(repoConfig),
    fetchedPullNumbers: getDownloadedPullRequestNumbers(repoConfig),
    type: 'GITHUB',
  };
}

export function updateMetadataFile(
  repoConfig: RepoConfig<GithubConnector>,
  recordsToUpdate: Partial<GithubSourceDataMetadata>
): void {
  const filename = getGithubMetadataPath(repoConfig);
  const existingMetadata: GithubSourceDataMetadata = fs.existsSync(filename)
    ? readJsonFile(filename)
    : getDefaultGithubSourceDataMetadata(repoConfig);

  writeJsonToFile(filename, {...existingMetadata, ...recordsToUpdate});
}

export function getPullRequestNumberFromUrl(url: string): number {
  // Assumes the URL looks like this: https://api.github.com/repos/alloytech/alloy/pulls/850
  const parts = url.split('/');
  return parseInt(parts[parts.length - 1], 10);
}
