import Docker from 'dockerode';
import { ExecResult, FileEntry, Space, SpaceStats } from './types';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const IMAGE = process.env.CLAWDSPACE_IMAGE || 'clawdspace:latest';
const PREFIX = 'clawdspace-';
const VOLUME_PREFIX = 'clawdspace-vol-';
const WORKSPACE_MOUNT = '/workspace';

// Track last activity per space
const lastActivity = new Map<string, string>();

export function getLastActivity(name: string): string | undefined {
  return lastActivity.get(name);
}

export function setLastActivity(name: string): void {
  lastActivity.set(name, new Date().toISOString());
}

export function deleteLastActivity(name: string): void {
  lastActivity.delete(name);
}

function getVolumeName(spaceName: string): string {
  return `${VOLUME_PREFIX}${spaceName}`;
}

async function initWorkspaceVolume(spaceName: string): Promise<void> {
  // Ensure the sandbox user can write into the per-space volume.
  // Do this via a short-lived helper container so we do not touch host paths directly.
  const volumeName = getVolumeName(spaceName);

  const helper = await docker.createContainer({
    Image: IMAGE,
    User: "root",
    WorkingDir: WORKSPACE_MOUNT,
    HostConfig: {
      AutoRemove: true,
      NetworkMode: "none",
      Mounts: [{ Type: "volume", Source: volumeName, Target: WORKSPACE_MOUNT, ReadOnly: false }]
    },
    Cmd: ["sh", "-lc", "chown -R 1001:1001 /workspace && chmod -R u+rwX,g+rwX /workspace"],
    Labels: { "clawdspace.kind": "volume-init", "clawdspace.space": spaceName }
  });

  await helper.start();
  await helper.wait();
}


export async function ensureSpaceVolume(spaceName: string): Promise<Docker.Volume> {
  const volumeName = getVolumeName(spaceName);

  try {
    const volume = docker.getVolume(volumeName);
    await volume.inspect();
    return volume;
  } catch {
    // Create below
  }

  await docker.createVolume({
    Name: volumeName,
    Labels: {
      'clawdspace.kind': 'space-volume',
      'clawdspace.space': spaceName
    }
  });

  return docker.getVolume(volumeName);
}

export async function getContainer(name: string): Promise<Docker.Container | null> {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c => c.Names.includes(`/${PREFIX}${name}`));
  if (!container) return null;
  return docker.getContainer(container.Id);
}

export async function formatSpace(container: Docker.Container): Promise<Space> {
  const info = await container.inspect();
  const name = info.Name.replace(`/${PREFIX}`, '');
  const status: Space['status'] = info.State.Paused
    ? 'paused'
    : info.State.Running
      ? 'running'
      : 'stopped';

  const workspaceMount = (info.Mounts || []).find(m => m.Destination === WORKSPACE_MOUNT);

  return {
    name,
    id: info.Id.substring(0, 12),
    status,
    created: info.Created,
    started: info.State.StartedAt,
    image: info.Config.Image,
    memory: info.HostConfig.Memory || 0,
    cpus: (info.HostConfig.NanoCpus || 0) / 1e9,
    lastActivity: lastActivity.get(name) || info.State.StartedAt,
    volume: workspaceMount
      ? { name: workspaceMount.Name || getVolumeName(name), mountpoint: WORKSPACE_MOUNT }
      : undefined
  };
}

export async function listSpaces(): Promise<Space[]> {
  const containers = await docker.listContainers({ all: true });
  const spaces: Space[] = [];

  for (const c of containers) {
    if (c.Names.some(n => n.startsWith(`/${PREFIX}`))) {
      const container = docker.getContainer(c.Id);
      spaces.push(await formatSpace(container));
    }
  }

  return spaces;
}

export function parseMemory(str: string): number {
  const match = str.match(/^(\d+)(g|m|k)?$/i);
  if (!match) return 2 * 1024 * 1024 * 1024; // Default 2GB
  const num = parseInt(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  const multipliers: Record<string, number> = {
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024
  };
  return num * (multipliers[unit] || 1);
}

export async function createSpace(
  name: string,
  memory: string = '2g',
  cpus: number = 1,
  gpu: boolean = false,
  image?: string
): Promise<Space> {
  const memoryBytes = parseMemory(memory);
  const nanoCpus = cpus * 1e9;

  await ensureSpaceVolume(name);
  await initWorkspaceVolume(name);

  const useImage = image || (gpu
    ? (process.env.CLAWDSPACE_GPU_IMAGE || 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime')
    : IMAGE);

  const hostConfig: Docker.HostConfig = {
    Memory: memoryBytes,
    NanoCpus: nanoCpus,
    RestartPolicy: { Name: 'unless-stopped' },

    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],

    ReadonlyRootfs: true,
    Tmpfs: {
      '/tmp': 'rw,noexec,nosuid,nodev,size=512m',
      '/run': 'rw,noexec,nosuid,nodev,size=16m'
    },

    PidsLimit: 512,

    NetworkMode: 'none',

    Mounts: [
      {
        Type: 'volume',
        Source: getVolumeName(name),
        Target: WORKSPACE_MOUNT,
        ReadOnly: false
      }
    ]
  };

  if (gpu) {
    hostConfig.NetworkMode = 'bridge';
    hostConfig.DeviceRequests = [{
      Driver: '',
      Count: -1,
      DeviceIDs: [],
      Capabilities: [['gpu']],
      Options: {}
    }];
  }

  const container = await docker.createContainer({
    Image: useImage,
    name: `${PREFIX}${name}`,
    Hostname: name,
    User: gpu ? 'root' : 'sandbox',
    WorkingDir: WORKSPACE_MOUNT,
    HostConfig: hostConfig,
    Cmd: ['sleep', 'infinity'],
    Labels: {
      'clawdspace.kind': 'space',
      'clawdspace.space': name,
      'clawdspace.volume': getVolumeName(name)
    }
  });

  await container.start();
  setLastActivity(name);

  return formatSpace(container);
}

export async function destroySpace(name: string, removeVolume: boolean = false): Promise<void> {
  const container = await getContainer(name);
  if (!container) throw new Error('Space not found');

  await container.remove({ force: true });
  deleteLastActivity(name);

  if (removeVolume) {
    try {
      await docker.getVolume(getVolumeName(name)).remove({ force: true });
    } catch {
      // ignore
    }
  }
}

export async function stopSpace(name: string): Promise<void> {
  const container = await getContainer(name);
  if (!container) throw new Error('Space not found');

  await container.pause();
}

export async function startSpace(name: string): Promise<void> {
  const container = await getContainer(name);
  if (!container) throw new Error('Space not found');

  const info = await container.inspect();
  if (info.State.Paused) {
    await container.unpause();
  } else if (!info.State.Running) {
    await container.start();
  }

  setLastActivity(name);
}

export async function execInSpace(name: string, command: string | string[]): Promise<ExecResult> {
  const container = await getContainer(name);
  if (!container) throw new Error('Space not found');

  const info = await container.inspect();
  if (info.State.Paused) {
    await container.unpause();
  }

  const cmd = Array.isArray(command) ? command : ['sh', '-c', command];

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    User: info.Config.User || 'sandbox',
    WorkingDir: WORKSPACE_MOUNT
  });

  const stream = await exec.start({});

  let stdout = '';
  let stderr = '';

  await new Promise<void>((resolve, reject) => {
    const stdoutStream = { write: (chunk: unknown) => { stdout += String(chunk); return true; } };
    const stderrStream = { write: (chunk: unknown) => { stderr += String(chunk); return true; } };
    docker.modem.demuxStream(stream, stdoutStream as NodeJS.WritableStream, stderrStream as NodeJS.WritableStream);
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const result = await exec.inspect();
  setLastActivity(name);

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode: result.ExitCode || 0
  };
}

export async function getDockerInfo() {
  return docker.info();
}

export async function getSpaceStats(name: string): Promise<SpaceStats> {
  const container = await getContainer(name);
  if (!container) throw new Error('Space not found');

  const stream: any = await container.stats({ stream: false });

  const cpuDelta = (stream.cpu_stats?.cpu_usage?.total_usage || 0) - (stream.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = (stream.cpu_stats?.system_cpu_usage || 0) - (stream.precpu_stats?.system_cpu_usage || 0);
  const onlineCpus = stream.cpu_stats?.online_cpus || stream.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

  const memUsage = stream.memory_stats?.usage || 0;
  const memLimit = stream.memory_stats?.limit || 0;

  const pids = stream.pids_stats?.current || 0;

  let rx = 0;
  let tx = 0;
  const networks = stream.networks || {};
  for (const key of Object.keys(networks)) {
    rx += networks[key]?.rx_bytes || 0;
    tx += networks[key]?.tx_bytes || 0;
  }

  let blkRead = 0;
  let blkWrite = 0;
  const blk = stream.blkio_stats?.io_service_bytes_recursive || [];
  for (const entry of blk) {
    if (entry.op === 'Read') blkRead += entry.value || 0;
    if (entry.op === 'Write') blkWrite += entry.value || 0;
  }

  return {
    cpuPercent,
    memoryUsageBytes: memUsage,
    memoryLimitBytes: memLimit,
    pids,
    networkRxBytes: rx,
    networkTxBytes: tx,
    blockReadBytes: blkRead,
    blockWriteBytes: blkWrite
  };
}

function normalizePath(input: string): string {
  let p = input || '';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\\/g, '/');
  p = p.replace(/\/+/g, '/');

  const parts: string[] = [];
  for (const segment of p.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }

  return '/' + parts.join('/');
}

export function resolveWorkspacePath(relPath: string): string {
  const p = normalizePath(relPath);
  const full = normalizePath(WORKSPACE_MOUNT + p);
  if (!full.startsWith(WORKSPACE_MOUNT + '/')) {
    return WORKSPACE_MOUNT;
  }
  return full;
}

export async function listFiles(name: string, relPath: string): Promise<FileEntry[]> {
  const target = resolveWorkspacePath(relPath);

  const py = [
    'python3',
    '-c',
    [
      'import os, json, stat, sys',
      'p=sys.argv[1]',
      'out=[]',
      'try:',
      '  entries=os.listdir(p)',
      'except FileNotFoundError:',
      '  print(json.dumps({"error":"not_found"})); sys.exit(2)',
      'except NotADirectoryError:',
      '  print(json.dumps({"error":"not_dir"})); sys.exit(2)',
      'for name in sorted(entries):',
      '  fp=os.path.join(p,name)',
      '  try:',
      '    st=os.lstat(fp)',
      '  except FileNotFoundError:',
      '    continue',
      '  mode=st.st_mode',
      '  t="other"',
      '  if stat.S_ISDIR(mode): t="dir"',
      '  elif stat.S_ISREG(mode): t="file"',
      '  elif stat.S_ISLNK(mode): t="symlink"',
      '  out.append({"name":name,"path":fp,"type":t,"size":st.st_size,"mtimeMs":int(st.st_mtime*1000)})',
      'print(json.dumps(out))'
    ].join('\n'),
    target
  ];

  const result = await execInSpace(name, py);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to list files');
  }

  const parsed = JSON.parse(result.stdout) as FileEntry[] | { error: string };
  if (!Array.isArray(parsed)) {
    throw new Error((parsed as any).error || 'Failed to list files');
  }

  return parsed.map(e => ({
    ...e,
    path: e.path.startsWith(WORKSPACE_MOUNT) ? (e.path.substring(WORKSPACE_MOUNT.length) || '/') : e.path
  }));
}

export async function readFile(
  name: string,
  relPath: string,
  maxBytes: number = 256 * 1024
): Promise<{ contentBase64: string; truncated: boolean }> {
  const target = resolveWorkspacePath(relPath);

  const cmd = [
    'python3',
    '-c',
    [
      'import base64, sys',
      'p=sys.argv[1]',
      'maxb=int(sys.argv[2])',
      'with open(p,"rb") as f: b=f.read(maxb+1)',
      'trunc=len(b)>maxb',
      'b=b[:maxb]',
      'print(base64.b64encode(b).decode("ascii"))',
      'print("\\nTRUNCATED" if trunc else "\\nOK", end="")'
    ].join('\n'),
    target,
    String(maxBytes)
  ];

  const result = await execInSpace(name, cmd);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to read file');
  }

  const markerIdx = result.stdout.lastIndexOf('\n');
  const b64 = markerIdx >= 0 ? result.stdout.slice(0, markerIdx) : result.stdout;
  const marker = markerIdx >= 0 ? result.stdout.slice(markerIdx + 1) : 'OK';

  return { contentBase64: b64.trim(), truncated: marker.includes('TRUNCATED') };
}

export async function writeFile(name: string, relPath: string, contentBase64: string): Promise<void> {
  const target = resolveWorkspacePath(relPath);

  const cmd = [
    'python3',
    '-c',
    [
      'import base64, os, sys',
      'p=sys.argv[1]',
      'data=base64.b64decode(sys.argv[2].encode("ascii"))',
      'os.makedirs(os.path.dirname(p), exist_ok=True)',
      'with open(p,"wb") as f: f.write(data)',
      'print("OK")'
    ].join('\n'),
    target,
    contentBase64
  ];

  const result = await execInSpace(name, cmd);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to write file');
  }
}

// Auto-sleep worker
export function startAutoSleepWorker(idleTimeoutMs: number = 10 * 60 * 1000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const containers = await docker.listContainers();
      const now = Date.now();

      for (const c of containers) {
        if (!c.Names.some(n => n.startsWith(`/${PREFIX}`))) continue;
        if (c.State === 'paused') continue;

        const name = c.Names[0].replace(`/${PREFIX}`, '');
        const last = lastActivity.get(name);

        if (last && (now - new Date(last).getTime()) > idleTimeoutMs) {
          console.log(`Auto-sleeping space: ${name}`);
          const container = docker.getContainer(c.Id);
          await container.pause();
        }
      }
    } catch (err) {
      console.error('Auto-sleep error:', err);
    }
  }, 60000);
}
