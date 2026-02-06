import fs from 'fs';
import os from 'os';
import path from 'path';

interface Settings {
  readonly storageDirectory?: string;
}

const SETTINGS_DIR = path.join(os.homedir(), '.repostats');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');
const SETTINGS_EXAMPLE_FILE = path.join(SETTINGS_DIR, 'settings.example.json');

export function getSettingsFilePath(): string {
  return SETTINGS_FILE;
}

export function ensureSettingsDir(): void {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, {recursive: true});
  }

  const exampleSettings = {
    storageDirectory: getDefaultStorageDirectory(),
  };
  fs.writeFileSync(SETTINGS_EXAMPLE_FILE, JSON.stringify(exampleSettings, null, 2) + '\n');
}

function getDefaultStorageDirectory(): string {
  const home = os.homedir();
  if (os.type() === 'Darwin') {
    return `${home}/Documents/repostats`;
  }
  return `${home}/repostats`;
}

function readSettings(): Settings {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function getStorageDirectory(): string {
  const settings = readSettings();
  return settings.storageDirectory || getDefaultStorageDirectory();
}
