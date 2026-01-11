import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function isAllowedGitUrl(raw: string): boolean {
  // Keep v1 conservative: only allow https:// and git@ github-style.
  // This avoids odd transports (ssh://, file://, ext::) being used.
  const u = raw.trim();
  if (!u) return false;
  if (u.startsWith('https://')) return true;
  // Git SSH scp-like syntax: git@github.com:org/repo.git
  if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:[^\s]+$/.test(u)) return true;
  return false;
}

function ensureSafeRef(input: string | undefined, kind: 'branch' | 'dest'): string | undefined {
  if (!input) return undefined;
  const v = input.trim();
  if (!v) return undefined;

  if (kind === 'branch') {
    // Basic allowlist. Reject refs like "--upload-pack=...".
    if (!/^[A-Za-z0-9._\/-]+$/.test(v)) {
      throw new Error('Invalid repoBranch');
    }
    return v;
  }

  // dest must be a relative path within /workspace.
  // We allow simple folder paths, no traversal.
  if (!/^[A-Za-z0-9._\/-]+$/.test(v) || v.startsWith('/') || v.includes('..')) {
    throw new Error('Invalid repoDest');
  }
  return v;
}

export type RepoCloneRequest = {
  repoUrl: string;
  repoBranch?: string;
  repoDest?: string;
};

export function validateRepoCloneRequest(req?: RepoCloneRequest): RepoCloneRequest | null {
  if (!req?.repoUrl) return null;

  const repoUrl = req.repoUrl.trim();
  if (!isAllowedGitUrl(repoUrl)) {
    throw new Error('Invalid repoUrl (only https:// or git@host:org/repo.git)');
  }

  const repoBranch = ensureSafeRef(req.repoBranch, 'branch');
  const repoDest = ensureSafeRef(req.repoDest, 'dest') || 'repo';

  return { repoUrl, repoBranch, repoDest };
}

export async function ensureGithubAuthForUrl(repoUrl: string): Promise<void> {
  // Best-effort: if gh is installed + authed, it can provide credentials for https clones.
  // This keeps secrets out of Clawdspace, leaning on the operator's existing GitHub auth.
  if (!repoUrl.startsWith('https://github.com/')) return;

  try {
    await execFileAsync('gh', ['auth', 'status', '-h', 'github.com'], { timeout: 4000 });
  } catch {
    // No gh or not authed: clone may still work (public repo), otherwise will fail.
  }
}
