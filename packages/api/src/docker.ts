import Docker from 'dockerode';
import { Space, ExecResult } from './types';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const IMAGE = process.env.CLAWDSPACE_IMAGE || 'clawdspace:latest';
const PREFIX = 'clawdspace-';

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

export async function getContainer(name: string): Promise<Docker.Container | null> {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c => c.Names.includes(`/${PREFIX}${name}`));
  if (!container) return null;
  return docker.getContainer(container.Id);
}

export async function formatSpace(container: Docker.Container): Promise<Space> {
  const info = await container.inspect();
  const name = info.Name.replace(`/${PREFIX}`, '');
  const status: Space['status'] = info.State.Paused ? 'paused' : 
                                   info.State.Running ? 'running' : 'stopped';
  
  return {
    name,
    id: info.Id.substring(0, 12),
    status,
    created: info.Created,
    started: info.State.StartedAt,
    image: info.Config.Image,
    memory: info.HostConfig.Memory || 0,
    cpus: (info.HostConfig.NanoCpus || 0) / 1e9,
    lastActivity: lastActivity.get(name) || info.State.StartedAt
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
  cpus: number = 1
): Promise<Space> {
  const memoryBytes = parseMemory(memory);
  const nanoCpus = cpus * 1e9;
  
  const container = await docker.createContainer({
    Image: IMAGE,
    name: `${PREFIX}${name}`,
    Hostname: name,
    User: 'sandbox',
    WorkingDir: '/home/sandbox',
    HostConfig: {
      Memory: memoryBytes,
      NanoCpus: nanoCpus,
      RestartPolicy: { Name: 'unless-stopped' }
    },
    Cmd: ['sleep', 'infinity']
  });
  
  await container.start();
  setLastActivity(name);
  
  return formatSpace(container);
}

export async function destroySpace(name: string): Promise<void> {
  const container = await getContainer(name);
  if (!container) throw new Error('Space not found');
  
  await container.remove({ force: true });
  deleteLastActivity(name);
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
  
  // Ensure container is running
  const info = await container.inspect();
  if (info.State.Paused) {
    await container.unpause();
  }
  
  // Parse command
  const cmd = Array.isArray(command) ? command : ['sh', '-c', command];
  
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    User: 'sandbox'
  });
  
  const stream = await exec.start({});
  
  let stdout = '';
  let stderr = '';
  
  await new Promise<void>((resolve, reject) => {
    docker.modem.demuxStream(
      stream, 
      { write: (chunk: Buffer) => { stdout += chunk.toString(); return true; } },
      { write: (chunk: Buffer) => { stderr += chunk.toString(); return true; } }
    );
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
