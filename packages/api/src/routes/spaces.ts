import { Router, Request, Response } from 'express';
import * as docker from '../docker';
import { CreateSpaceRequest, ExecRequest } from '../types';
import { validateRepoCloneRequest } from '../git';
import { validateEnvFileWriteRequest } from '../envfile';
import { getGhToken, isGithubHttpsRepoUrl, toGithubTokenCloneUrl } from '../github';
import { getTemplate } from '../templates/store';
import { applyTemplateToCreateRequest } from '../templates/apply';
import { templateDefaults } from '../templates/effective';
import { ensureImageHasGit } from '../dockerImage';

const router = Router();

// GET /spaces - List all spaces
router.get('/', async (_req: Request, res: Response) => {
  try {
    const spaces = await docker.listSpaces();
    res.json({ spaces });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces - Create space
router.post('/', async (req: Request, res: Response) => {
  try {
    let {
      name,
      memory = '2g',
      cpus = 1,
      gpu = false,
      image,
      template,
      repoUrl,
      repoBranch,
      repoDest,
      envFileBase64,
      envFileText,
      envFilePath
    } = req.body as CreateSpaceRequest;

    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid name (alphanumeric, _, - only)' });
    }

    // Check if exists
    const existing = await docker.getContainer(name);
    if (existing) {
      return res.status(409).json({ error: 'Space already exists' });
    }

    // Apply template defaults (if provided)
    let templateLabels: Record<string, string> | undefined;
    let templateNetworkMode: 'bridge' | 'none' | undefined;
    let templateWritableRootfs: boolean | undefined;

    if (template) {
      try {
        const tpl = await getTemplate(template);
        const merged = applyTemplateToCreateRequest({ req: req.body as CreateSpaceRequest, template: tpl });
        const eff = templateDefaults(tpl);

        name = merged.name;
        memory = merged.memory ?? memory;
        cpus = merged.cpus ?? cpus;
        gpu = merged.gpu ?? gpu;
        image = merged.image ?? image;
        repoDest = merged.repoDest ?? repoDest;

        // Managed templates can override the chosen base image.
        // This keeps GPU spaces on our sandbox image (git/apt/etc) while still enabling GPU runtime.
        if (tpl.managed) {
          image = undefined;
        }

        templateLabels = {
          'clawdspace.template': tpl.name,
          'clawdspace.network.mode': tpl.network?.mode || 'internet'
        };
        templateNetworkMode = eff.networkMode;
        templateWritableRootfs = eff.writableRootfs;
      } catch (e) {
        return res.status(400).json({ error: `Invalid template: ${(e as Error).message}` });
      }
    }

    const env = (req.body as CreateSpaceRequest).env;
    const space = await docker.createSpace(name, memory, cpus, gpu, image, env, {
      networkMode: templateNetworkMode,
      writableRootfs: templateWritableRootfs,
      labels: templateLabels
    });

    // If using a custom image (commonly GPU images), ensure git is available for optional repo clones.
    // This is best-effort; cloning will still fail with a clear error if git can't be installed.
    if (repoUrl) {
      await ensureImageHasGit({ spaceName: name, image: space.image }).catch(() => undefined);
    }

    // Optional: write an env file into /workspace
    try {
      const envReq = validateEnvFileWriteRequest({ envFileBase64, envFileText, envFilePath });
      if (envReq) {
        const b64 = Buffer.from(envReq.content, 'utf8').toString('base64');
        await docker.writeFile(name, envReq.path.replace('/workspace', ''), b64);
      }
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }

    // Optional: clone repo into the new space workspace
    let didClone = false;

    try {
      const cloneReq = validateRepoCloneRequest({ repoUrl, repoBranch, repoDest } as any);
      if (cloneReq) {
        // If the template explicitly disables network, cloning is not possible.
        if (templateNetworkMode === 'none') {
          return res.status(400).json({ error: 'Repo clone failed: selected template has network disabled' });
        }

        const dest = cloneReq.repoDest || 'repo';
        const branchArg = cloneReq.repoBranch ? `-b ${cloneReq.repoBranch}` : '';

        // Private GitHub https repos:
        // Prefer a per-space token provided by the caller (env.GITHUB_TOKEN), otherwise fall back to host gh token.
        let urlForClone = cloneReq.repoUrl;
        const requestEnv = (req.body as CreateSpaceRequest).env;

        if (isGithubHttpsRepoUrl(cloneReq.repoUrl)) {
          const tokenFromRequest = requestEnv?.GITHUB_TOKEN?.trim();
          const token = tokenFromRequest || (await getGhToken());

          if (!token) {
            return res.status(400).json({
              error:
                'Repo clone failed: provide env.GITHUB_TOKEN (PAT) or authenticate the host with `gh auth login`'
            });
          }

          urlForClone = toGithubTokenCloneUrl(cloneReq.repoUrl, token);
        }

        const cmd = [
          'sh',
          '-lc',
          [
            'set -e',
            `cd /workspace`,
            `rm -rf "${dest}"`,
            `git clone ${branchArg} "${urlForClone}" "${dest}"`,
            ...(isGithubHttpsRepoUrl(cloneReq.repoUrl)
              ? [`cd "${dest}"`, `git remote set-url origin "${cloneReq.repoUrl.replace(/\.git$/, '')}.git"`]
              : [])
          ].join(' && ')
        ];

        const result = await docker.execInSpace(name, cmd);
        if (result.exitCode !== 0) {
          return res.status(400).json({ error: `Repo clone failed: ${result.stderr || result.stdout || 'unknown error'}` });
        }

        didClone = true;
      }
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }

    if (didClone) {
      docker.setLastActivity(name);
      // NOTE: auditing of the clone itself is captured via the exec audit.
    }

    res.status(201).json({ space });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /spaces/:name - Get space details
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const container = await docker.getContainer(req.params.name);
    if (!container) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const space = await docker.formatSpace(container);
    res.json({ space });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /spaces/:name - Destroy space
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const removeVolume = String(req.query.removeVolume || 'false') === 'true';
    await docker.destroySpace(req.params.name, removeVolume);
    res.json({ message: 'Space destroyed' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces/:name/stop - Pause space
router.post('/:name/stop', async (req: Request, res: Response) => {
  try {
    await docker.stopSpace(req.params.name);
    res.json({ message: 'Space paused' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces/:name/start - Resume space
router.post('/:name/start', async (req: Request, res: Response) => {
  try {
    await docker.startSpace(req.params.name);
    res.json({ message: 'Space started' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces/:name/exec - Execute command
router.post('/:name/exec', async (req: Request, res: Response) => {
  try {
    const { command } = req.body as ExecRequest;

    if (!command) {
      return res.status(400).json({ error: 'Command required' });
    }

    const result = await docker.execInSpace(req.params.name, command);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /spaces/:name/stats - Per-space resource stats
router.get('/:name/stats', async (req: Request, res: Response) => {
  try {
    const stats = await docker.getSpaceStats(req.params.name);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /spaces/:name/observability - richer per-space observability snapshot
router.get('/:name/observability', async (req: Request, res: Response) => {
  try {
    const snapshot = await docker.getSpaceObservability(req.params.name);
    res.json({ observability: snapshot });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /spaces/:name/files?path=/ - List directory (scoped to /workspace)
router.get('/:name/files', async (req: Request, res: Response) => {
  try {
    const relPath = String(req.query.path || '/');
    const entries = await docker.listFiles(req.params.name, relPath);
    res.json({ path: relPath, entries });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /spaces/:name/file?path=/foo.txt - Read file (base64, scoped to /workspace)
router.get('/:name/file', async (req: Request, res: Response) => {
  try {
    const relPath = String(req.query.path || '');
    if (!relPath) return res.status(400).json({ error: 'path required' });

    const maxBytes = req.query.maxBytes ? parseInt(String(req.query.maxBytes)) : undefined;
    const data = await docker.readFile(req.params.name, relPath, maxBytes);
    res.json({ path: relPath, ...data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /spaces/:name/file?path=/foo.txt - Write file (base64, scoped to /workspace)
router.put('/:name/file', async (req: Request, res: Response) => {
  try {
    const relPath = String(req.query.path || '');
    if (!relPath) return res.status(400).json({ error: 'path required' });

    const contentBase64 = (req.body?.contentBase64 as string | undefined) || '';
    if (!contentBase64) return res.status(400).json({ error: 'contentBase64 required' });

    await docker.writeFile(req.params.name, relPath, contentBase64);
    res.json({ message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
