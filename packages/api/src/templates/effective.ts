import { SpaceTemplate } from './schema';

export function templateDefaults(t: SpaceTemplate): {
  memory?: string;
  cpus?: number;
  gpu?: boolean;
  image?: string;
  networkMode?: 'bridge' | 'none';
  writableRootfs?: boolean;
  repoDest?: string;
} {
  const networkMode = t.network?.mode === 'none' ? 'none' : 'bridge';

  return {
    memory: t.resources?.memory != null ? String(t.resources.memory) : undefined,
    cpus: t.resources?.cpus,
    gpu: t.resources?.gpu,
    image: t.resources?.image,
    networkMode,
    writableRootfs: t.security?.writableRootfs,
    repoDest: t.workspace?.defaultRepoDest
  };
}
