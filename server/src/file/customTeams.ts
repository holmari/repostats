import fs from 'fs';

import {getRootPath} from './paths';
import {readJsonFile, writeJsonToFile} from './json';
import {TeamInfo} from '../types/types';

export function getCustomTeamsFilePath(): string {
  return `${getRootPath()}/custom-teams.json`;
}

export function readCustomTeams(): TeamInfo[] {
  const filePath = getCustomTeamsFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return readJsonFile<TeamInfo[]>(filePath);
}

export function writeCustomTeams(teams: TeamInfo[]): void {
  writeJsonToFile(getCustomTeamsFilePath(), teams);
}

export function generateSlug(name: string, existingSlugs: ReadonlyArray<string>): string {
  const base =
    'custom-' +
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  if (!existingSlugs.includes(base)) {
    return base;
  }

  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}
