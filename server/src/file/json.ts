import fs from 'fs';
import CryptoJs from 'crypto-js';
import path from 'path';
import {ensurePathExists} from './paths';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stringifyJson(jsonObject: unknown): string {
  return JSON.stringify(jsonObject, null, 2);
}

export function readJsonFile<T>(filename: string): T {
  const content = fs.readFileSync(filename, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse JSON from ${filename}: ${(e as Error).message}`);
  }
}

export function writeJsonToFile(filename: string, jsonObject: unknown): string {
  if (!filename.endsWith('.json')) {
    throw new Error(
      `The filename does not end with .json; is the argument correct? Was: '${filename}'`
    );
  }

  ensurePathExists(path.dirname(filename));

  const dataToWrite = stringifyJson(jsonObject);

  // Validate the JSON is parseable before writing
  try {
    JSON.parse(dataToWrite);
  } catch (e) {
    throw new Error(`Attempted to write invalid JSON to ${filename}: ${(e as Error).message}`);
  }

  // Atomic write: write to temp file, then rename
  // This prevents corrupted files from partial writes if the process crashes
  const tempFile = `${filename}.tmp`;
  fs.writeFileSync(tempFile, dataToWrite, 'utf-8');
  fs.renameSync(tempFile, filename);

  return CryptoJs.MD5(dataToWrite).toString();
}
