import crypto from 'crypto';
import fs from 'fs';
import os from 'os';

export interface SSHKeyInfo {
  readonly id: string;
  readonly name: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

interface SSHKeyMetadata {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

function getRootPath(): string {
  const home = os.homedir();
  if (os.type() === 'Darwin') {
    return `${home}/Documents/repostats`;
  }
  return `${home}/repostats`;
}

export function getSSHKeysPath(): string {
  return `${getRootPath()}/ssh`;
}

function getSSHKeyFilePath(keyId: string): string {
  return `${getSSHKeysPath()}/${keyId}`;
}

function getSSHKeyMetadataPath(): string {
  return `${getSSHKeysPath()}/metadata.json`;
}

function ensureSSHKeysPath(): void {
  const path = getSSHKeysPath();
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {recursive: true, mode: 0o700});
  }
}

function readMetadata(): SSHKeyMetadata[] {
  const metadataPath = getSSHKeyMetadataPath();
  if (!fs.existsSync(metadataPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeMetadata(metadata: SSHKeyMetadata[]): void {
  ensureSSHKeysPath();
  fs.writeFileSync(getSSHKeyMetadataPath(), JSON.stringify(metadata, null, 2), 'utf-8');
}

function computeFingerprint(privateKey: string): string {
  // Extract public key from private key and compute SHA256 fingerprint
  // For simplicity, we compute SHA256 of the key content
  const hash = crypto.createHash('sha256').update(privateKey.trim()).digest('base64');
  return `SHA256:${hash.substring(0, 43)}`;
}

export function listSSHKeys(): SSHKeyInfo[] {
  const metadata = readMetadata();

  return metadata
    .filter((m) => fs.existsSync(getSSHKeyFilePath(m.id)))
    .map((m) => {
      const keyContent = fs.readFileSync(getSSHKeyFilePath(m.id), 'utf-8');
      return {
        id: m.id,
        name: m.name,
        fingerprint: computeFingerprint(keyContent),
        createdAt: m.createdAt,
      };
    });
}

export function saveSSHKey(name: string, privateKey: string): SSHKeyInfo {
  ensureSSHKeysPath();

  const id = crypto.randomUUID();
  const keyPath = getSSHKeyFilePath(id);
  const createdAt = new Date().toISOString();

  // Ensure key ends with newline
  const keyContent = privateKey.trim() + '\n';

  // Write the key file with restricted permissions (0600)
  fs.writeFileSync(keyPath, keyContent, {mode: 0o600});

  // Update metadata
  const metadata = readMetadata();
  metadata.push({id, name, createdAt});
  writeMetadata(metadata);

  return {
    id,
    name,
    fingerprint: computeFingerprint(keyContent),
    createdAt,
  };
}

export function deleteSSHKey(keyId: string): void {
  const keyPath = getSSHKeyFilePath(keyId);

  // Remove key file
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
  }

  // Update metadata
  const metadata = readMetadata();
  const updatedMetadata = metadata.filter((m) => m.id !== keyId);
  writeMetadata(updatedMetadata);
}

export function getSSHKeyPath(keyId: string): string | null {
  const keyPath = getSSHKeyFilePath(keyId);
  if (fs.existsSync(keyPath)) {
    return keyPath;
  }
  return null;
}

export function sshKeyExists(keyId: string): boolean {
  return fs.existsSync(getSSHKeyFilePath(keyId));
}
