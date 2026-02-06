import {spawn} from 'child_process';
import fs from 'fs';

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
