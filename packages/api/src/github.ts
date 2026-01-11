import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function isGithubHttpsRepoUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/.test(url.trim());
}

export function toGithubTokenCloneUrl(repoUrl: string, token: string): string {
  // Use x-access-token for GitHub HTTPS auth.
  // Avoid logging this URL anywhere.
  const u = repoUrl.trim().replace(/\.git$/, '') + '.git';
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${u.split('github.com/')[1]}`;
}

export async function verifyGhAuth(): Promise<boolean> {
  try {
    await execFileAsync('gh', ['auth', 'status', '-h', 'github.com'], { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

export async function getGhToken(): Promise<string | null> {
  // Reads the token from the host's gh auth store (no token passed over the wire).
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token', '-h', 'github.com'], { timeout: 4000 });
    const t = stdout.trim();
    return t ? t : null;
  } catch {
    return null;
  }
}
