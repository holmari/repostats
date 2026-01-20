import {Response, Request} from 'express';
import {spawn} from 'child_process';

import {
  listSSHKeys,
  saveSSHKey,
  deleteSSHKey,
  getSSHKeyPath,
  SSHKeyInfo,
} from '../ssh/keys';
import {getSettings} from './settings';

export interface SSHKeyListResponse {
  readonly keys: SSHKeyInfo[];
  readonly activeKeyId: string | null;
}

export interface SSHKeySaveRequest {
  readonly name: string;
  readonly privateKey: string;
}

export interface SSHKeyTestResult {
  readonly success: boolean;
  readonly message: string;
}

export function listSSHKeysHandler(_req: Request, res: Response): void {
  const keys = listSSHKeys();
  const settings = getSettings();

  const response: SSHKeyListResponse = {
    keys,
    activeKeyId: settings.activeSSHKeyId ?? null,
  };

  res.json(response);
}

export function saveSSHKeyHandler(req: Request, res: Response): void {
  const {name, privateKey} = req.body as SSHKeySaveRequest;

  if (!name || !privateKey) {
    res.status(400).json({message: 'Name and privateKey are required'});
    return;
  }

  // Basic validation that it looks like a private key
  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('PRIVATE KEY-----')) {
    res.status(400).json({message: 'Invalid private key format'});
    return;
  }

  try {
    const keyInfo = saveSSHKey(name, privateKey);
    res.json(keyInfo);
  } catch (error) {
    res.status(500).json({message: `Failed to save key: ${error}`});
  }
}

export function deleteSSHKeyHandler(req: Request, res: Response): void {
  const {keyId} = req.params;

  try {
    deleteSSHKey(keyId);
    res.json({success: true});
  } catch (error) {
    res.status(500).json({message: `Failed to delete key: ${error}`});
  }
}

export async function testSSHConnectionHandler(req: Request, res: Response): Promise<void> {
  const {keyId} = req.body;

  if (!keyId) {
    res.status(400).json({message: 'keyId is required'});
    return;
  }

  const keyPath = getSSHKeyPath(keyId);
  if (!keyPath) {
    res.status(404).json({message: 'SSH key not found'});
    return;
  }

  try {
    const result = await testSSHConnection(keyPath);
    res.json(result);
  } catch (error) {
    res.status(500).json({message: `Failed to test connection: ${error}`});
  }
}

function testSSHConnection(keyPath: string): Promise<SSHKeyTestResult> {
  return new Promise((resolve) => {
    const ssh = spawn('ssh', [
      '-i', keyPath,
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=10',
      '-T',
      'git@github.com',
    ]);

    let stdout = '';
    let stderr = '';

    ssh.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ssh.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ssh.on('close', (code) => {
      // GitHub returns exit code 1 even on successful auth
      // The message "Hi <username>!" indicates success
      const output = stdout + stderr;
      const success = output.includes('successfully authenticated') ||
                      output.includes('Hi ') ||
                      code === 1 && output.includes('github.com');

      resolve({
        success,
        message: success
          ? 'Successfully connected to GitHub'
          : output || 'Connection failed',
      });
    });

    ssh.on('error', (error) => {
      resolve({
        success: false,
        message: `SSH error: ${error.message}`,
      });
    });
  });
}
