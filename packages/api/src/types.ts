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

export interface NodeInfo {
  name: string;
  url: string;
  status: 'online' | 'offline';
  latencyMs?: number;
  capabilities?: {
    gpu?: boolean;
    gpuName?: string;
    gpuMemory?: string;
    arch?: string;
    platform?: string;
  };
}

export interface CreateSpaceRequest {
  name: string;
  memory?: string;
  cpus?: number;
  gpu?: boolean;
  image?: string;

  // Optional: seed the space by cloning a repo into /workspace.
  repoUrl?: string;
  repoBranch?: string;
  repoDest?: string;

  // Optional: write an env file into /workspace.
  // Accepts either a base64-encoded file or plain text.
  envFileBase64?: string;
  envFileText?: string;
  envFilePath?: string; // default: /workspace/.env

  // Optional: inject env vars into the container at creation time.
  // These will be available for exec/terminal sessions.
  env?: Record<string, string>;
}

export interface SpaceObservability {
  stats: SpaceStats;
  workspaceDisk?: {
    totalBytes?: number;
    usedBytes?: number;
    availBytes?: number;
    usedPercent?: number;
    path?: string;
  };
  workspaceSizeBytes?: number;
  top?: Array<{ pid: number; cpu: number; mem: number; etime: string; command: string }>;
  bashHistoryTail?: string;
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
