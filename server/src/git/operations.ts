import {spawn} from 'child_process';
import fs from 'fs';

interface GitExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface GitAuth {
  readonly type: 'ssh' | 'token';
  // For SSH: path to the private key file
  // For token: the GitHub personal access token
  readonly credential: string;
}

function createEnv(auth: GitAuth): NodeJS.ProcessEnv {
  if (auth.type === 'ssh') {
    return {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -i "${auth.credential}" -o StrictHostKeyChecking=accept-new -o BatchMode=yes`,
    };
  }
  // For token auth, use GIT_ASKPASS to provide credentials without embedding in URL
  return {
    ...process.env,
    GIT_ASKPASS: 'echo',
    GIT_TERMINAL_PROMPT: '0',
  };
}

function execGit(
  args: string[],
  cwd: string | undefined,
  auth: GitAuth
): Promise<GitExecResult> {
  return new Promise((resolve, reject) => {
    const env = createEnv(auth);
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

function buildRepoUrl(repoUrl: string, auth: GitAuth): string {
  if (auth.type === 'ssh') {
    return repoUrl;
  }
  // For token auth, embed token in HTTPS URL
  // repoUrl is like https://github.com/owner/repo or git@github.com:owner/repo.git
  // We need https://x-access-token:TOKEN@github.com/owner/repo.git
  const httpsMatch = repoUrl.match(/^https?:\/\/github\.com\/(.+)/);
  if (httpsMatch) {
    return `https://x-access-token:${auth.credential}@github.com/${httpsMatch[1]}`;
  }
  const sshMatch = repoUrl.match(/^git@github\.com:(.+)/);
  if (sshMatch) {
    return `https://x-access-token:${auth.credential}@github.com/${sshMatch[1]}`;
  }
  return repoUrl;
}

export async function cloneOrFetchRepo(
  repoUrl: string,
  targetPath: string,
  auth: GitAuth
): Promise<void> {
  const authUrl = buildRepoUrl(repoUrl, auth);

  if (fs.existsSync(targetPath) && fs.existsSync(`${targetPath}/.git`)) {
    // Repo exists - update remote URL in case auth changed, then fetch
    await execGit(['remote', 'set-url', 'origin', authUrl], targetPath, auth);

    console.log(`Fetching updates for ${targetPath}`);
    const result = await execGit(['fetch', '--all'], targetPath, auth);
    if (result.exitCode !== 0) {
      throw new Error(`Git fetch failed: ${result.stderr}`);
    }

    // Reset to origin/HEAD or origin/main or origin/master
    const resetResult = await execGit(
      ['reset', '--hard', 'origin/HEAD'],
      targetPath,
      auth
    );
    if (resetResult.exitCode !== 0) {
      // Try origin/main
      const mainResult = await execGit(
        ['reset', '--hard', 'origin/main'],
        targetPath,
        auth
      );
      if (mainResult.exitCode !== 0) {
        // Try origin/master
        await execGit(['reset', '--hard', 'origin/master'], targetPath, auth);
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
      ['clone', '--quiet', authUrl, targetPath],
      undefined,
      auth
    );
    if (result.exitCode !== 0) {
      throw new Error(`Git clone failed: ${result.stderr}`);
    }
  }
}
