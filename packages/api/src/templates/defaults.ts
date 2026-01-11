import yaml from 'js-yaml';
import { SpaceTemplate } from './schema';

export function defaultTemplates(): SpaceTemplate[] {
  return [
    {
      name: 'default',
      description: 'Internet access, block LAN + metadata by policy',
      resources: { memory: '2g', cpus: 1, gpu: false },
      security: { writableRootfs: true },
      network: {
        mode: 'internet',
        blockCidrs: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '169.254.0.0/16']
      },
      workspace: { defaultRepoDest: 'repo' }
    },
    {
      name: 'gpu',
      description: 'GPU-enabled space (internet) using clawdspace-gpu image',
      managed: true,
      resources: {
        memory: '8g',
        cpus: 4,
        gpu: true,
        image: 'clawdspace-gpu:latest'
      },
      security: { writableRootfs: true },
      network: {
        mode: 'internet',
        blockCidrs: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '169.254.0.0/16']
      },
      workspace: { defaultRepoDest: 'repo' }
    },
    {
      name: 'offline',
      description: 'No network',
      resources: { memory: '2g', cpus: 1, gpu: false },
      security: { writableRootfs: true },
      network: { mode: 'none', blockCidrs: [] },
      workspace: { defaultRepoDest: 'repo' }
    },
    {
      name: 'lan',
      description: 'Internet + LAN access (no CIDR blocks)',
      resources: { memory: '2g', cpus: 1, gpu: false },
      security: { writableRootfs: true },
      network: { mode: 'lan', blockCidrs: [] },
      workspace: { defaultRepoDest: 'repo' }
    }
  ];
}

export function serializeTemplate(t: SpaceTemplate): string {
  return yaml.dump(t, { sortKeys: false });
}
