import { Router, Request, Response } from 'express';
import * as docker from '../docker';
import { isGithubHttpsRepoUrl, toGithubTokenCloneUrl } from '../github';

const router = Router();

// POST /spaces/:name/git/push
// Body: { repoPath?: string, remote?: string, branch?: string, token?: string }
router.post('/:name/git/push', async (req: Request, res: Response) => {
  try {
    const spaceName = req.params.name;
    const repoPath = String(req.body?.repoPath || '/repo');
    if (!repoPath.startsWith('/')) {
      return res.status(400).json({ error: 'repoPath must be absolute (e.g. /repo)' });
    }
    const remote = String(req.body?.remote || 'origin');
    const branch = String(req.body?.branch || 'main');
    const token = String(req.body?.token || '').trim();

    if (!token) return res.status(400).json({ error: 'token required' });

    // Determine clean remote URL.
    const remoteUrlRes = await docker.execInSpace(spaceName, [
      'sh',
      '-lc',
      `cd /workspace${repoPath} && git remote get-url ${remote}`
    ]);
    if (remoteUrlRes.exitCode !== 0) {
      return res.status(400).json({ error: remoteUrlRes.stderr || remoteUrlRes.stdout || 'Failed to get remote URL' });
    }

    const cleanUrl = remoteUrlRes.stdout.trim();
    const pushUrl = isGithubHttpsRepoUrl(cleanUrl) ? toGithubTokenCloneUrl(cleanUrl, token) : cleanUrl;

    // Set push URL and push.
    const cmd = [
      'sh',
      '-lc',
      [
        'set -e',
        `cd /workspace${repoPath}`,
        `git remote set-url --push ${remote} "${pushUrl}"`,
        `git push ${remote} ${branch}`,
        // Reset pushurl back to normal after push.
        `git remote set-url --push ${remote} "${cleanUrl}"`
      ].join(' && ')
    ];

    const result = await docker.execInSpace(spaceName, cmd);
    if (result.exitCode !== 0) {
      return res.status(400).json({ error: result.stderr || result.stdout || 'git push failed' });
    }

    docker.setLastActivity(spaceName);
    res.json({ stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
