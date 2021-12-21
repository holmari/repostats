import fs from 'fs';
import CryptoJs from 'crypto-js';
import path from 'path';
import {ensurePathExists} from './paths';

export function stringifyJson(jsonObject: unknown): string {
  return JSON.stringify(jsonObject, null, 2);
}

export function readJsonFile<T>(filename: string): T {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf-8'));
  } catch (e: unknown) {
    console.error(`could not parse ${filename}`);
    throw e;
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
  fs.writeFileSync(filename, dataToWrite, 'utf-8');

  return CryptoJs.MD5(dataToWrite).toString();
}
