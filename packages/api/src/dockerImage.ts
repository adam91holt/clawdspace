import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function ensureImageHasGit({
  spaceName
}: {
  spaceName: string;
  image: string;
}): Promise<void> {
  // Best-effort: if the running container is missing git, install it.
  // This avoids `docker run <image>` checks (which may time out on large images).

  try {
    await execFileAsync(
      'docker',
      [
        'exec',
        '-u',
        'root',
        `clawdspace-${spaceName}`,
        'sh',
        '-lc',
        [
          'set -e',
          'command -v git >/dev/null 2>&1 && exit 0',
          'apt-get update',
          'apt-get install -y git ca-certificates',
          'rm -rf /var/lib/apt/lists/*'
        ].join(' && ')
      ],
      { timeout: 300000 }
    );
  } catch {
    // ignore
  }
}
