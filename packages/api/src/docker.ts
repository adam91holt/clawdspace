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
  cpus: number = 1,
  gpu: boolean = false,
  image?: string
): Promise<Space> {
  const memoryBytes = parseMemory(memory);
  const nanoCpus = cpus * 1e9;
  
  // Use GPU image if requested and no custom image specified
  const useImage = image || (gpu ? (process.env.CLAWDSPACE_GPU_IMAGE || 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime') : IMAGE);
  
  const hostConfig: Docker.HostConfig = {
    Memory: memoryBytes,
    NanoCpus: nanoCpus,
    RestartPolicy: { Name: 'unless-stopped' }
  };
  
  // Add GPU support if requested
  if (gpu) {
    hostConfig.DeviceRequests = [{
      Driver: '',
      Count: -1,  // All GPUs
      DeviceIDs: [],
      Capabilities: [['gpu']],
      Options: {}
    }];
  }
  
  const container = await docker.createContainer({
    Image: useImage,
    name: `${PREFIX}${name}`,
    Hostname: name,
    User: gpu ? 'root' : 'sandbox',  // PyTorch image needs root
    WorkingDir: gpu ? '/workspace' : '/home/sandbox',
    HostConfig: hostConfig,
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
  
  // Use the same user the container was created with
  const user = info.Config.User || 'root';
  
  // Parse command
  const cmd = Array.isArray(command) ? command : ['sh', '-c', command];
  
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    User: user
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
