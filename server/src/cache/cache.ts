import CryptoJs from 'crypto-js';
import fs from 'fs';

import {readJsonFile, writeJsonToFile} from '../file/json';
import {deletePath, ensurePathExists, ensurePaths, getCachePath} from '../file/paths';

// Bump this version when the response structure changes to invalidate old cache entries.
// This ensures clients don't receive stale data with missing fields after code updates.
const CACHE_SCHEMA_VERSION = 19;

export enum CachePath {
  analysis = 'analysis',
  download = 'download',
  users = 'users',
  gitStats = 'git-stats',
}

export function getCacheKey(keyObject: unknown | string): string {
  if (typeof keyObject === 'string') {
    return `${keyObject}-v${CACHE_SCHEMA_VERSION}`;
  }

  const keyWithVersion = {_v: CACHE_SCHEMA_VERSION, ...keyObject as object};
  const serializedKey = JSON.stringify(keyWithVersion);
  return CryptoJs.SHA1(serializedKey).toString();
}

export function getCacheFilename(keyObject: unknown | string, cachePath: CachePath): string {
  const filename = `${getCacheKey(keyObject)}.json`;

  return `${getCachePath()}/${cachePath}/${filename}`;
}

export function readFromCache<T>(keyObject: unknown | string, cachePath: CachePath): T | null {
  const filename = getCacheFilename(keyObject, cachePath);

  if (!fs.existsSync(filename)) {
    return null;
  }

  return readJsonFile(filename);
}

export function writeToCache<T>(
  keyObject: unknown | string,
  cachePath: CachePath,
  payload: T
): string {
  return writeJsonToFile(getCacheFilename(keyObject, cachePath), payload);
}

export function clearCache(): void {
  deletePath(getCachePath());
  ensurePaths();

  Object.keys(CachePath).forEach((path) => {
    ensurePathExists(`${getCachePath()}/${path}`);
  });
}
