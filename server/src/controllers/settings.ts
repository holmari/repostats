import {Response, Request} from 'express';
import fs from 'fs';

import {getCachePath} from '../file/paths';
import {AppSettings} from '../types/types';
import {readJsonFile, writeJsonToFile} from '../file/json';

const DEFAULT_SETTINGS: AppSettings = {
  excludedUserIds: [],
  excludedTeamSlugs: [],
};

function getSettingsPath(): string {
  return `${getCachePath()}/settings.json`;
}

export function getSettings(): AppSettings {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return DEFAULT_SETTINGS;
  }

  try {
    return readJsonFile(settingsPath);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getSettingsHandler(_req: Request, res: Response): void {
  res.json(getSettings());
}

export function saveSettingsHandler(req: Request, res: Response): void {
  const settings: AppSettings = {
    excludedUserIds: req.body.excludedUserIds || [],
    excludedTeamSlugs: req.body.excludedTeamSlugs || [],
  };

  writeJsonToFile(getSettingsPath(), settings);
  res.json(settings);
}
