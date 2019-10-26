import fs from 'fs';
import {getConfigPath} from './paths';
import {RepoConfig, RepoSourceDataMetadata} from '../types/types';
import {getGithubMetadataPath} from '../controllers/github/paths';
import {
  getDefaultGithubSourceDataMetadata,
  getGithubSourceDataMetadata,
} from '../controllers/github/utils';
import {readJsonFile} from './json';

export function getConfigFile(repoName: string): RepoConfig {
  if (!fs.existsSync(getConfigPath(repoName))) {
    throw new Error(`Config file for ${repoName} does not exist.`);
  }
  return readJsonFile(getConfigPath(repoName));
}

export function getSourceMetadataFilePath(repoConfig: RepoConfig): string {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return getGithubMetadataPath(repoConfig);
    default:
      throw new Error(`Unsupported connector type ${repoConfig.connector.type}`);
  }
}

function getDefaultRepoSourceDataMetadata(repoConfig: RepoConfig): RepoSourceDataMetadata {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return getDefaultGithubSourceDataMetadata(repoConfig);
    default:
      throw new Error(`Unsupported connector type ${repoConfig.connector.type}`);
  }
}

function getRepoSourceDataMetadata(repoConfig: RepoConfig) {
  switch (repoConfig.connector.type) {
    case 'GITHUB':
      return getGithubSourceDataMetadata(repoConfig);
    default:
      throw new Error(`Unsupported connector type ${repoConfig.connector.type}`);
  }
}

export function getSourceDataMetadata(repoConfig: RepoConfig): RepoSourceDataMetadata {
  return fs.existsSync(getSourceMetadataFilePath(repoConfig))
    ? getRepoSourceDataMetadata(repoConfig)
    : getDefaultRepoSourceDataMetadata(repoConfig);
}
