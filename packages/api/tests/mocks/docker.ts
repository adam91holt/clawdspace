import { vi } from 'vitest';
import { Space, ExecResult, FileEntry, SpaceStats } from '../../src/types';

// In-memory store for mock spaces
export const mockSpaces = new Map<string, Space>();

// Simple file store keyed by space -> path -> base64
const mockFiles = new Map<string, Map<string, string>>();

// Mock space factory
export function createMockSpace(name: string, overrides: Partial<Space> = {}): Space {
  return {
    name,
    id: Math.random().toString(36).substring(2, 14),
    status: 'running',
    created: new Date().toISOString(),
    started: new Date().toISOString(),
    image: 'clawdspace:latest',
    memory: 2 * 1024 * 1024 * 1024,
    cpus: 1,
    lastActivity: new Date().toISOString(),
    ...overrides
  };
}

// Mock docker functions
export const mockDocker = {
  listSpaces: vi.fn(async (): Promise<Space[]> => {
    return Array.from(mockSpaces.values());
  }),

  getContainer: vi.fn(async (name: string) => {
    return mockSpaces.has(name) ? { name } : null;
  }),

  formatSpace: vi.fn(async (container: { name: string }): Promise<Space> => {
    return mockSpaces.get(container.name)!;
  }),

  createSpace: vi.fn(async (name: string, memory: string = '2g', cpus: number = 1, gpu: boolean = false, image?: string): Promise<Space> => {
    const space = createMockSpace(name, {
      memory: parseMemory(memory),
      cpus,
      image: image || (gpu ? 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime' : 'clawdspace:latest')
    });
    mockSpaces.set(name, space);
    mockFiles.set(name, new Map([['/.clawdspace_init', ''], ['/.clawdspace_verify', '']]));
    return space;
  }),

  destroySpace: vi.fn(async (name: string, _removeVolume: boolean = false): Promise<void> => {
    if (!mockSpaces.has(name)) throw new Error('Space not found');
    mockSpaces.delete(name);
    mockFiles.delete(name);
  }),

  stopSpace: vi.fn(async (name: string): Promise<void> => {
    const space = mockSpaces.get(name);
    if (!space) throw new Error('Space not found');
    space.status = 'paused';
  }),

  startSpace: vi.fn(async (name: string): Promise<void> => {
    const space = mockSpaces.get(name);
    if (!space) throw new Error('Space not found');
    space.status = 'running';
    space.lastActivity = new Date().toISOString();
  }),

  execInSpace: vi.fn(async (name: string, command: string | string[]): Promise<ExecResult> => {
    const space = mockSpaces.get(name);
    if (!space) throw new Error('Space not found');
    
    // Auto-unpause on exec
    if (space.status === 'paused') {
      space.status = 'running';
    }
    space.lastActivity = new Date().toISOString();
    
    // Simulate command execution
    const cmd = Array.isArray(command) ? command.join(' ') : command;
    return {
      stdout: `Mock output for: ${cmd}`,
      stderr: '',
      exitCode: 0
    };
  }),

  getDockerInfo: vi.fn(async () => ({
    ServerVersion: '24.0.0',
    Containers: mockSpaces.size,
    ContainersRunning: Array.from(mockSpaces.values()).filter(s => s.status === 'running').length,
    ContainersPaused: Array.from(mockSpaces.values()).filter(s => s.status === 'paused').length,
    Images: 1
  })),

  getLastActivity: vi.fn((name: string) => mockSpaces.get(name)?.lastActivity),
  setLastActivity: vi.fn(),
  deleteLastActivity: vi.fn(),
  getSpaceStats: vi.fn(async (name: string): Promise<SpaceStats> => {
    const space = mockSpaces.get(name);
    if (!space) throw new Error('Space not found');
    return {
      cpuPercent: 0,
      memoryUsageBytes: 0,
      memoryLimitBytes: space.memory,
      pids: 1,
      networkRxBytes: 0,
      networkTxBytes: 0,
      blockReadBytes: 0,
      blockWriteBytes: 0
    };
  }),

  listFiles: vi.fn(async (name: string, relPath: string): Promise<FileEntry[]> => {
    const files = mockFiles.get(name);
    if (!files) throw new Error('Space not found');

    const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
    const entries: FileEntry[] = [];

    for (const [p, contentBase64] of files.entries()) {
      if (!p.startsWith(path)) continue;
      const remainder = p.slice(path === '/' ? 1 : path.length + 1);
      if (!remainder) continue;
      if (remainder.includes('/')) continue;

      entries.push({
        name: remainder,
        path: path === '/' ? `/${remainder}` : `${path}/${remainder}`,
        type: 'file',
        size: Buffer.from(contentBase64 || '', 'base64').length,
        mtimeMs: Date.now()
      });
    }

    return entries;
  }),

  readFile: vi.fn(async (name: string, relPath: string): Promise<{ contentBase64: string }> => {
    const files = mockFiles.get(name);
    if (!files) throw new Error('Space not found');
    const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
    if (!files.has(path)) throw new Error('File not found');
    return { contentBase64: files.get(path) || '' };
  }),

  writeFile: vi.fn(async (name: string, relPath: string, contentBase64: string): Promise<void> => {
    const files = mockFiles.get(name);
    if (!files) throw new Error('Space not found');
    const path = relPath.startsWith('/') ? relPath : `/${relPath}`;
    files.set(path, contentBase64 || '');
  }),

  startAutoSleepWorker: vi.fn(() => setInterval(() => {}, 60000))
};

function parseMemory(str: string): number {
  const match = str.match(/^(\d+)(g|m|k)?$/i);
  if (!match) return 2 * 1024 * 1024 * 1024;
  const num = parseInt(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  const multipliers: Record<string, number> = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
  return num * (multipliers[unit] || 1);
}

// Reset mocks between tests
export function resetMocks() {
  mockSpaces.clear();
  mockFiles.clear();
  Object.values(mockDocker).forEach(fn => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
}
