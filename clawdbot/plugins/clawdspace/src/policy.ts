import type { ClawdspaceConfig } from "./config.js";

export function requireAllowedSpace(config: ClawdspaceConfig, space: string): void {
  const name = space.trim();
  if (!name) throw new Error("space required");

  if (config.denySpaces?.includes(name)) {
    throw new Error(`Space denied by policy: ${name}`);
  }

  if (config.allowSpaces && !config.allowSpaces.includes(name)) {
    throw new Error(`Space not in allowlist: ${name}`);
  }
}

export function resolveSpace(config: ClawdspaceConfig, space?: string): string {
  const resolved = (space ?? config.defaultSpace ?? "").trim();
  if (!resolved) {
    throw new Error("space required (set defaultSpace or pass space param)");
  }
  requireAllowedSpace(config, resolved);
  return resolved;
}
