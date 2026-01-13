import type { ClawdspaceConfig } from "./config.js";

export type ClawdspaceClient = {
  baseUrl: string;
  request: <T>(
    path: string,
    init?: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      json?: unknown;
      signal?: AbortSignal;
    },
  ) => Promise<T>;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown>): string {
  const base = normalizeBaseUrl(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;

  const u = new URL(base + p);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n…(truncated to ${maxChars} chars)`;
}

export function resolveNodeBaseUrl(config: ClawdspaceConfig, node?: string): string {
  const key = (node ?? config.defaultNode ?? "").trim();
  if (!key) return config.baseUrl;

  const mapped = config.nodeMap?.[key];
  if (mapped && mapped.trim()) return mapped;

  // If the caller passed a full URL as node, accept it.
  if (/^https?:\/\//i.test(key)) return key;

  throw new Error(`Unknown node: ${key}`);
}

export function createClawdspaceClient(params: {
  config: ClawdspaceConfig;
  node?: string;
  logger?: { warn: (msg: string) => void };
}): ClawdspaceClient {
  const { config, node, logger } = params;
  const baseUrl = resolveNodeBaseUrl(config, node);

  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("Clawdspace baseUrl must start with http:// or https://");
  }

  if (baseUrl.startsWith("http://") && /\bngrok\b|\bfly\.dev\b|\bvercel\.app\b/i.test(baseUrl)) {
    logger?.warn(
      "[clawdspace] baseUrl is http:// on what looks like a public host; consider https://",
    );
  }

  const request = async <T>(
    path: string,
    init?: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      json?: unknown;
      signal?: AbortSignal;
    },
  ): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const url = buildUrl(baseUrl, path, init?.query);

      const res = await fetch(url, {
        method: init?.method ?? (init?.json ? "POST" : "GET"),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: init?.json ? JSON.stringify(init.json) : undefined,
        signal: init?.signal
          ? AbortSignal.any([init.signal, controller.signal])
          : controller.signal,
      });

      const text = await res.text();
      const safeText = truncate(text, config.maxExecOutputChars);

      if (!res.ok) {
        throw new Error(`Clawdspace HTTP ${res.status}: ${safeText}`);
      }

      if (!safeText) return {} as T;

      try {
        return JSON.parse(safeText) as T;
      } catch {
        // Some endpoints might return plain text.
        return safeText as T;
      }
    } finally {
      clearTimeout(timeout);
    }
  };

  return { baseUrl, request };
}
