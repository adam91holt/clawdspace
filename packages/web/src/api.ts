import { Space, SystemInfo, ExecResult, SpaceStats, SpaceObservability, FileEntry, NodeInfo } from './types';

function getStoredKey(): string {
  return (localStorage.getItem('clawdspace_key') || '').trim();
}

const headers = {
  'Content-Type': 'application/json'
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getStoredKey();
  const url = key ? `/api${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : `/api${path}`;

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  getSpaces: () => request<{ spaces: Space[] }>('/spaces'),

  getSpace: (name: string) => request<{ space: Space }>(`/spaces/${name}`),

  createSpace: (
    name: string,
    memory: string,
    cpus: number,
    gpu: boolean = false,
    repo?: { repoUrl: string; repoBranch?: string; repoDest?: string }
  ) =>
    request<{ space: Space }>('/spaces', {
      method: 'POST',
      body: JSON.stringify({ name, memory, cpus, gpu, ...(repo || {}) })
    }),

  destroySpace: (name: string, removeVolume: boolean = false) =>
    request<{ message: string }>(`/spaces/${name}?removeVolume=${removeVolume ? 'true' : 'false'}`, { method: 'DELETE' }),

  stopSpace: (name: string) =>
    request<{ message: string }>(`/spaces/${name}/stop`, { method: 'POST' }),

  startSpace: (name: string) =>
    request<{ message: string }>(`/spaces/${name}/start`, { method: 'POST' }),

  execCommand: (name: string, command: string) =>
    request<ExecResult>(`/spaces/${name}/exec`, {
      method: 'POST',
      body: JSON.stringify({ command })
    }),

  getSpaceStats: (name: string) => request<{ stats: SpaceStats }>(`/spaces/${name}/stats`),

  getSpaceObservability: (name: string) =>
    request<{ observability: SpaceObservability }>(`/spaces/${name}/observability`),

  listFiles: (name: string, path: string) =>
    request<{ path: string; entries: FileEntry[] }>(`/spaces/${name}/files?path=${encodeURIComponent(path)}`),

  readFile: (name: string, path: string, maxBytes: number = 256 * 1024) =>
    request<{ path: string; contentBase64: string; truncated: boolean }>(
      `/spaces/${name}/file?path=${encodeURIComponent(path)}&maxBytes=${maxBytes}`
    ),

  writeFile: (name: string, path: string, contentBase64: string) =>
    request<{ message: string }>(`/spaces/${name}/file?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ contentBase64 })
    }),

  getSystem: () => request<SystemInfo>('/system'),

  getNodes: () => request<{ nodes: NodeInfo[]; lastUpdatedAt?: number }>('/nodes'),

  getAudit: (space?: string) => request<{ events: any[] }>(`/audit${space ? `?space=${encodeURIComponent(space)}` : ''}`)
};

export function setApiKey(key: string) {
  localStorage.setItem('clawdspace_key', key.trim());
  window.location.reload();
}

export function getApiKey(): string {
  return getStoredKey();
}

// Prompt for API key on first load
if (!getStoredKey()) {
  const key = window.prompt('Enter API Key:');
  if (key) {
    setApiKey(key);
  }
}
