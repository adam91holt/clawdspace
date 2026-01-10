import { Space, SystemInfo, ExecResult } from './types';

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
  
  createSpace: (name: string, memory: string, cpus: number) =>
    request<{ space: Space }>('/spaces', {
      method: 'POST',
      body: JSON.stringify({ name, memory, cpus })
    }),
  
  destroySpace: (name: string) =>
    request<{ message: string }>(`/spaces/${name}`, { method: 'DELETE' }),
  
  stopSpace: (name: string) =>
    request<{ message: string }>(`/spaces/${name}/stop`, { method: 'POST' }),
  
  startSpace: (name: string) =>
    request<{ message: string }>(`/spaces/${name}/start`, { method: 'POST' }),
  
  execCommand: (name: string, command: string) =>
    request<ExecResult>(`/spaces/${name}/exec`, {
      method: 'POST',
      body: JSON.stringify({ command })
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
