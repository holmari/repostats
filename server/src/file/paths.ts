import fs from 'fs';

import {getStorageDirectory} from './settings';

export function getRootPath(): string {
  return getStorageDirectory();
}

export function ensurePathExists(path: string): void {
  fs.mkdirSync(path, {recursive: true});
}

export function getCachePath(): string {
  return `${getRootPath()}/cache`;
}

export function getGitClonesPath(): string {
  return `${getRootPath()}/git-clones`;
}

export function getGitClonePath(repoName: string): string {
  return `${getGitClonesPath()}/${repoName}`;
}

export function getReposPath(): string {
  return `${getRootPath()}/repos`;
}

export function ensurePaths(): void {
  ensurePathExists(getReposPath());
  ensurePathExists(getCachePath());
}

export function getRepoPath(repoName: string): string {
  return `${getReposPath()}/${repoName}`;
}

export function getConfigPath(repoName: string): string {
  return `${getRepoPath(repoName)}/config.json`;
}

export function getSourceDataPath(repoName: string): string {
  return `${getRepoPath(repoName)}/source-data`;
}

export function ensureRepoPaths(repoName: string): void {
  if (!fs.existsSync(getRepoPath(repoName))) {
    fs.mkdirSync(getRepoPath(repoName));
  }
  if (!fs.existsSync(getSourceDataPath(repoName))) {
    fs.mkdirSync(getSourceDataPath(repoName));
  }
}

export function deletePath(path: string): void {
  if (!fs.existsSync(path)) {
    return;
  }

  if (!fs.statSync(path).isDirectory()) {
    fs.unlinkSync(path);
    return;
  }

  const files = fs.readdirSync(path);
  files.forEach((file) => {
    const fileAbsPath = `${path}/${file}`;
    if (fs.statSync(fileAbsPath).isDirectory()) {
      deletePath(fileAbsPath);
    } else {
      fs.unlinkSync(fileAbsPath);
    }
  });

  fs.rmSync(path, {recursive: true});
}
