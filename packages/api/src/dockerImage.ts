import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function ensureImageHasGit({
  spaceName,
  image
}: {
  spaceName: string;
  image: string;
}): Promise<void> {
  // Best-effort check: if the selected image is missing git, install it.
  // This is mainly for GPU images like pytorch/pytorch which often omit git.
  // If install fails, cloning will fail with a clearer error.

  const checkCmd = ['docker', 'run', '--rm', image, 'sh', '-lc', 'command -v git >/dev/null 2>&1 && echo ok || echo missing'];
  try {
    const { stdout } = await execFileAsync(checkCmd[0], checkCmd.slice(1), { timeout: 60000 });
    if ((stdout || '').trim() === 'ok') return;
  } catch {
    // If we can't check (no sh), just proceed.
    return;
  }

  // Attempt install. Requires root + apt.
  try {
    await execFileAsync('docker', [
      'exec',
      '-u',
      'root',
      `clawdspace-${spaceName}`,
      'sh',
      '-lc',
      'apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*'
    ], { timeout: 300000 });
  } catch {
    // ignore
  }
}
