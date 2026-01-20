import {spawn} from 'child_process';
import fs from 'fs';

export interface GitLogEntry {
  readonly sha: string;
  readonly authorEmail: string;
  readonly date: string;
  readonly insertions: number;
  readonly deletions: number;
}

interface GitExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function createSSHEnv(sshKeyPath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_SSH_COMMAND: `ssh -i "${sshKeyPath}" -o StrictHostKeyChecking=accept-new -o BatchMode=yes`,
  };
}

function execGit(
  args: string[],
  cwd: string | undefined,
  sshKeyPath: string
): Promise<GitExecResult> {
  return new Promise((resolve, reject) => {
    const env = createSSHEnv(sshKeyPath);
    const git = spawn('git', args, {cwd, env});

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    git.on('close', (exitCode) => {
      resolve({stdout, stderr, exitCode: exitCode ?? 0});
    });

    git.on('error', (error) => {
      reject(error);
    });
  });
}

export async function cloneOrFetchRepo(
  repoUrl: string,
  targetPath: string,
  sshKeyPath: string
): Promise<void> {
  if (fs.existsSync(targetPath) && fs.existsSync(`${targetPath}/.git`)) {
    // Repo exists, fetch updates
    console.log(`Fetching updates for ${targetPath}`);
    const result = await execGit(['fetch', '--all'], targetPath, sshKeyPath);
    if (result.exitCode !== 0) {
      throw new Error(`Git fetch failed: ${result.stderr}`);
    }

    // Reset to origin/HEAD or origin/main or origin/master
    const resetResult = await execGit(
      ['reset', '--hard', 'origin/HEAD'],
      targetPath,
      sshKeyPath
    );
    if (resetResult.exitCode !== 0) {
      // Try origin/main
      const mainResult = await execGit(
        ['reset', '--hard', 'origin/main'],
        targetPath,
        sshKeyPath
      );
      if (mainResult.exitCode !== 0) {
        // Try origin/master
        await execGit(['reset', '--hard', 'origin/master'], targetPath, sshKeyPath);
      }
    }
  } else {
    // Clone fresh
    console.log(`Cloning ${repoUrl} to ${targetPath}`);
    const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, {recursive: true});
    }

    const result = await execGit(
      ['clone', '--quiet', repoUrl, targetPath],
      undefined,
      sshKeyPath
    );
    if (result.exitCode !== 0) {
      throw new Error(`Git clone failed: ${result.stderr}`);
    }
  }
}

export async function getGitLogStats(
  repoPath: string,
  sshKeyPath: string,
  since?: string
): Promise<GitLogEntry[]> {
  // Use a format that's easy to parse: SHA|email|date
  // Then --shortstat gives us insertions/deletions
  const args = [
    'log',
    '--format=%H|%ae|%aI',
    '--shortstat',
    '--all',
  ];

  if (since) {
    args.push(`--since=${since}`);
  }

  const result = await execGit(args, repoPath, sshKeyPath);
  if (result.exitCode !== 0) {
    throw new Error(`Git log failed: ${result.stderr}`);
  }

  return parseGitLogOutput(result.stdout);
}

interface MutableGitLogEntry {
  sha: string;
  authorEmail: string;
  date: string;
  insertions: number;
  deletions: number;
}

function parseGitLogOutput(output: string): GitLogEntry[] {
  const entries: GitLogEntry[] = [];
  const lines = output.split('\n');

  let currentEntry: MutableGitLogEntry | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    // Check if this is a commit line (SHA|email|date)
    if (trimmedLine.includes('|') && trimmedLine.length >= 40) {
      // If we have a previous entry without stats, add it with zeros
      if (currentEntry) {
        entries.push({
          sha: currentEntry.sha,
          authorEmail: currentEntry.authorEmail,
          date: currentEntry.date,
          insertions: currentEntry.insertions,
          deletions: currentEntry.deletions,
        });
      }

      const parts = trimmedLine.split('|');
      if (parts.length >= 3) {
        currentEntry = {
          sha: parts[0],
          authorEmail: parts[1].toLowerCase(),
          date: parts[2],
          insertions: 0,
          deletions: 0,
        };
      }
    } else if (currentEntry && (trimmedLine.includes('insertion') || trimmedLine.includes('deletion'))) {
      // Parse shortstat line: " 3 files changed, 45 insertions(+), 12 deletions(-)"
      const insertionMatch = trimmedLine.match(/(\d+)\s+insertion/);
      const deletionMatch = trimmedLine.match(/(\d+)\s+deletion/);

      if (insertionMatch) {
        currentEntry.insertions = parseInt(insertionMatch[1], 10);
      }
      if (deletionMatch) {
        currentEntry.deletions = parseInt(deletionMatch[1], 10);
      }

      // Add entry and reset
      entries.push({
        sha: currentEntry.sha,
        authorEmail: currentEntry.authorEmail,
        date: currentEntry.date,
        insertions: currentEntry.insertions,
        deletions: currentEntry.deletions,
      });
      currentEntry = null;
    }
  }

  // Handle last entry if no stats line followed
  if (currentEntry) {
    entries.push({
      sha: currentEntry.sha,
      authorEmail: currentEntry.authorEmail,
      date: currentEntry.date,
      insertions: currentEntry.insertions,
      deletions: currentEntry.deletions,
    });
  }

  return entries;
}
