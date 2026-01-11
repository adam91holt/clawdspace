import { Space, SystemInfo, ExecResult, SpaceStats, FileEntry } from './types';

const API_KEY = localStorage.getItem('clawdspace_key') || '';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
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

  createSpace: (name: string, memory: string, cpus: number, gpu: boolean = false) =>
    request<{ space: Space }>('/spaces', {
      method: 'POST',
      body: JSON.stringify({ name, memory, cpus, gpu })
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

  getSystem: () => request<SystemInfo>('/system')
};

export function setApiKey(key: string) {
  localStorage.setItem('clawdspace_key', key);
  window.location.reload();
}

export function getApiKey(): string {
  return localStorage.getItem('clawdspace_key') || '';
}

// Prompt for API key on first load
if (!API_KEY) {
  const key = window.prompt('Enter API Key:');
  if (key) {
    setApiKey(key);
  }
}
