export interface Space {
  name: string;
  id: string;
  status: 'running' | 'paused' | 'stopped';
  created: string;
  started: string;
  image: string;
  memory: number;
  cpus: number;
  lastActivity: string;
  volume?: {
    name: string;
    mountpoint: string;
  };
}

export interface SpaceStats {
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  pids: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'other';
  size: number;
  mtimeMs: number;
}

export interface CreateSpaceRequest {
  name: string;
  memory?: string;
  cpus?: number;
  gpu?: boolean;
  image?: string;
}

export interface ExecRequest {
  command: string | string[];
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  loadAverage: number[];
  memory: {
    total: string;
    free: string;
    used: string;
    percentage: string;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    percentage: string;
  } | null;
  uptime: string;
  docker: {
    version: string;
    containers: number;
    containersRunning: number;
    containersPaused: number;
    images: number;
  };
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
