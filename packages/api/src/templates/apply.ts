import { CreateSpaceRequest } from '../types';
import { SpaceTemplate } from './schema';

export function applyTemplateToCreateRequest({
  req,
  template
}: {
  req: CreateSpaceRequest;
  template: SpaceTemplate;
}): CreateSpaceRequest {
  const resources = template.resources || ({} as any);

  const out: CreateSpaceRequest = {
    ...req,
    memory: req.memory ?? String(resources.memory ?? '2g'),
    cpus: req.cpus ?? Number(resources.cpus ?? 1),
    gpu: req.gpu ?? Boolean(resources.gpu ?? false),
    image: req.image ?? resources.image
  };

  // Network/security are enforced at the engine level, not via request fields (yet).
  // We keep them on the template for intent + UI.

  // workspace default repo dest
  if (!out.repoDest && req.repoUrl) {
    const d = template.workspace?.defaultRepoDest;
    if (d) out.repoDest = d;
  }

  return out;
}
