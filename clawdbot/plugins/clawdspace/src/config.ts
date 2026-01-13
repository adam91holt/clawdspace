import { z } from "zod";

export const ClawdspaceConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true),
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    timeoutMs: z.number().int().positive().optional().default(30_000),

    defaultSpace: z.string().min(1).optional(),
    defaultNode: z.string().min(1).optional(),

    nodeMap: z.record(z.string().min(1), z.string().min(1)).optional().default({}),

    allowSpaces: z.array(z.string().min(1)).optional(),
    denySpaces: z.array(z.string().min(1)).optional(),

    maxFileBytes: z.number().int().positive().optional().default(2_000_000),
    maxExecOutputChars: z.number().int().positive().optional().default(50_000),
  })
  .strict();

export type ClawdspaceConfig = z.infer<typeof ClawdspaceConfigSchema>;

export const clawdspaceConfigSchema = {
  parse(value: unknown): ClawdspaceConfig {
    const raw =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    // Allow a minimal config object; schema supplies defaults.
    return ClawdspaceConfigSchema.parse(raw);
  },
  uiHints: {
    enabled: { label: "Enabled" },
    baseUrl: {
      label: "Clawdspace Base URL",
      placeholder: "http://localhost:7777",
      help: "Base URL of a Clawdspace API node.",
    },
    apiKey: { label: "Clawdspace API Key", sensitive: true },
    timeoutMs: {
      label: "Request Timeout (ms)",
      advanced: true,
      placeholder: "30000",
    },
    defaultSpace: { label: "Default Space", placeholder: "dev" },
    defaultNode: {
      label: "Default Node",
      help: "Used when no node is specified in tool/RPC params.",
      advanced: true,
    },
    nodeMap: {
      label: "Node Map",
      help: "Map of node name -> Clawdspace baseUrl (used for multi-node routing).",
      advanced: true,
    },
    allowSpaces: {
      label: "Allow Spaces",
      help: "Optional allowlist of space names. If set, only these spaces can be targeted.",
      advanced: true,
    },
    denySpaces: {
      label: "Deny Spaces",
      help: "Optional denylist of space names. Deny wins.",
      advanced: true,
    },
    maxFileBytes: { label: "Max File Bytes", advanced: true },
    maxExecOutputChars: { label: "Max Exec Output Chars", advanced: true },
  },
};
