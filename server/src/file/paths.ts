import fs from 'fs';
import os from 'os';

function getRootPath() {
  const home = os.homedir();
  if (os.type() === 'Darwin') {
    return `${home}/Documents/repostats`;
  }
  return `${home}/repostats`;
}

export function ensurePathExists(path: string): void {
  fs.mkdirSync(path, {recursive: true});
}

export function getCachePath(): string {
  return `${getRootPath()}/cache`;
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
  const files = fs.readdirSync(path);
  files.forEach((file) => {
    const fileAbsPath = `${path}/${file}`;
    if (fs.statSync(fileAbsPath).isDirectory()) {
      deletePath(fileAbsPath);
    } else {
      fs.unlinkSync(fileAbsPath);
    }
  });

  fs.rmdirSync(path, {recursive: true});
}
