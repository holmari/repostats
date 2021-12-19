import CryptoJs from 'crypto-js';
import fs from 'fs';

import {readJsonFile} from './json';

export function getAllJsonFilenamesInDirectory(path: string): ReadonlyArray<string> {
  try {
    return fs
      .readdirSync(path, {withFileTypes: true})
      .flatMap((dirent) =>
        dirent.isDirectory()
          ? getAllJsonFilenamesInDirectory(`${path}/${dirent.name}`)
          : [`${path}/${dirent.name}`]
      )
      .filter((filename) => filename.endsWith('.json'));
  } catch (error: unknown) {
    return [];
  }
}

export function getAllDirectories(path: string): ReadonlyArray<string> {
  return fs
    .readdirSync(path, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => `${path}/${dirent.name}`);
}

export function* iterEachFile<T>(path: string): Generator<[T, string], void, unknown> {
  const allFilenames = getAllJsonFilenamesInDirectory(path);

  for (let i = 0; i < allFilenames.length; ++i) {
    const filename = allFilenames[i];
    yield [readJsonFile(filename) as T, filename];
  }
}

export function getFileMd5Hash(filename: string): string | null {
  try {
    const content = fs.readFileSync(filename, 'utf-8');
    return CryptoJs.MD5(content).toString();
  } catch (e) {
    return null;
  }
}
