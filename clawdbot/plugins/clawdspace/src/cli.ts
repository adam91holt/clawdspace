import fs from "node:fs";

import type { Command } from "commander";

import type { ClawdspaceConfig } from "./config.js";
import { createClawdspaceClient } from "./client.js";
import { resolveSpace } from "./policy.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

function parseEnvPairs(pairs: string[] | undefined): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const raw of pairs ?? []) {
    const idx = raw.indexOf("=");
    if (idx <= 0) {
      throw new Error(`Invalid --env entry: ${raw} (expected KEY=VALUE)`);
    }
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1);
    if (!key) {
      throw new Error(`Invalid --env entry: ${raw} (empty key)`);
    }
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

async function readStdinText(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(Buffer.from(c)));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export function registerClawdspaceCli(params: {
  program: Command;
  config: ClawdspaceConfig;
  logger: Logger;
}) {
  const { program, config, logger } = params;

  const root = program.command("clawdspace").description("Clawdspace utilities");

  root
    .command("health")
    .description("Probe Clawdspace /api/health")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request("/api/health");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ baseUrl: client.baseUrl, ...((res as any) ?? {}) }, null, 2));
    });

  root
    .command("system")
    .description("Fetch system info from Clawdspace node")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request("/api/system");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    });

  root
    .command("capabilities")
    .description("Fetch system capabilities (GPU, arch, etc)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request("/api/system/capabilities");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    });

  root
    .command("nodes")
    .description("List nodes (Tailscale-discovered by Clawdspace)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request("/api/nodes");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    });

  root
    .command("spaces")
    .description("List spaces")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request("/api/spaces");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    });

  root
    .command("stats")
    .description("Fetch per-space resource stats")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (spaceArg: string | undefined, options: { node?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/stats`, {
          method: "GET",
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  root
    .command("observability")
    .description("Fetch per-space observability snapshot")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (spaceArg: string | undefined, options: { node?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/observability`, {
          method: "GET",
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  root
    .command("audit")
    .description("Fetch audit events")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .option("--space <name>", "Filter by space name")
    .option("--limit <n>", "Max events", "200")
    .action(async (options: { node?: string; space?: string; limit?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const limit = Math.max(1, Number(options.limit ?? 200));
        const res = await client.request("/api/audit", {
          method: "GET",
          query: {
            limit,
            ...(options.space ? { space: options.space } : {}),
          },
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  const templates = root.command("templates").description("Template management");

  templates
    .command("ls")
    .description("List templates")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request("/api/templates");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    });

  templates
    .command("get")
    .description("Get a template (YAML)")
    .argument("<name>", "Template name")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (name: string, options: { node?: string }) => {
      const client = createClawdspaceClient({ config, node: options.node, logger });
      const res = await client.request(`/api/templates/${encodeURIComponent(name)}`, { method: "GET" });
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    });

  templates
    .command("put")
    .description("Upsert a template from YAML")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .option("--yaml <yaml>", "Template YAML string")
    .option("--file <path>", "Read YAML from a local file")
    .option("--stdin", "Read YAML from stdin")
    .action(async (options: { node?: string; yaml?: string; file?: string; stdin?: boolean }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });

        const yaml =
          options.stdin
            ? await readStdinText()
            : options.file
              ? fs.readFileSync(options.file, "utf8")
              : options.yaml ?? "";

        if (!yaml.trim()) {
          throw new Error("Missing YAML (use --yaml, --file, or --stdin)");
        }

        const res = await client.request("/api/templates", { method: "PUT", json: { yaml } });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  templates
    .command("rm")
    .description("Delete a template")
    .argument("<name>", "Template name")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (name: string, options: { node?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const res = await client.request(`/api/templates/${encodeURIComponent(name)}`, { method: "DELETE" });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  root
    .command("create")
    .description("Create a space")
    .argument("<name>", "Space name")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .option("--template <name>", "Template name")
    .option("--memory <mem>", "Memory (e.g. 2g, 512m)")
    .option("--cpus <n>", "CPU cores", (v) => Number(v))
    .option("--gpu", "Enable GPU")
    .option("--image <name>", "Docker image override")
    .option("--repo-url <url>", "Clone repo into /workspace")
    .option("--repo-branch <branch>", "Repo branch")
    .option("--repo-dest <dir>", "Destination dir under /workspace")
    .option(
      "--env <KEY=VALUE>",
      "Set env var for the space (repeatable)",
      (v: string, prev: string[] = []) => prev.concat(v),
      [],
    )
    .action(
      async (
        name: string,
        options: {
          node?: string;
          template?: string;
          memory?: string;
          cpus?: number;
          gpu?: boolean;
          image?: string;
          repoUrl?: string;
          repoBranch?: string;
          repoDest?: string;
          env?: string[];
        },
      ) => {
        try {
          const client = createClawdspaceClient({ config, node: options.node, logger });
          const payload: Record<string, unknown> = { name };

          if (options.template) payload.template = options.template;
          if (options.memory) payload.memory = options.memory;
          if (typeof options.cpus === "number" && !Number.isNaN(options.cpus)) {
            payload.cpus = options.cpus;
          }
          if (options.gpu) payload.gpu = true;
          if (options.image) payload.image = options.image;

          if (options.repoUrl) payload.repoUrl = options.repoUrl;
          if (options.repoBranch) payload.repoBranch = options.repoBranch;
          if (options.repoDest) payload.repoDest = options.repoDest;

          const env = parseEnvPairs(options.env);
          if (env) payload.env = env;

          const res = await client.request("/api/spaces", { method: "POST", json: payload });
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(res, null, 2));
        } catch (err) {
          logger.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      },
    );

  root
    .command("start")
    .description("Start (resume) a space")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (spaceArg: string | undefined, options: { node?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/start`, { method: "POST" });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  root
    .command("stop")
    .description("Stop (pause) a space")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (spaceArg: string | undefined, options: { node?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/stop`, { method: "POST" });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  root
    .command("destroy")
    .description("Destroy a space")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .option("--remove-volume", "Also remove the space volume")
    .action(async (spaceArg: string | undefined, options: { node?: string; removeVolume?: boolean }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}`, {
          method: "DELETE",
          query: { removeVolume: options.removeVolume ? "true" : undefined },
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  root
    .command("exec")
    .description("Execute a command in a space")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .argument("<command>", "Command to run")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (spaceArg: string | undefined, command: string, options: { node?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);

        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/exec`, {
          method: "POST",
          json: { command },
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  const files = root.command("files").description("Workspace file utilities");

  files
    .command("ls")
    .description("List files in /workspace")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .option("--path <path>", "Path under /workspace", "/")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .action(async (spaceArg: string | undefined, options: { node?: string; path?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/files`, {
          method: "GET",
          query: { path: options.path ?? "/" },
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  files
    .command("get")
    .description("Read a file from /workspace")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .argument("<path>", "Path under /workspace (e.g. /hello.txt)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .option("--json", "Print raw JSON response (includes base64)")
    .option("--out <path>", "Write content to a local file")
    .action(async (spaceArg: string | undefined, pathArg: string, options: { node?: string; json?: boolean; out?: string }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/file`, {
          method: "GET",
          query: { path: pathArg },
        });

        if (options.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(res, null, 2));
          return;
        }

        const contentBase64 = (res as any)?.contentBase64;
        if (typeof contentBase64 !== "string") {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(res, null, 2));
          return;
        }

        const buf = Buffer.from(contentBase64, "base64");
        if (options.out) {
          fs.writeFileSync(options.out, buf);
          return;
        }
        process.stdout.write(buf);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  files
    .command("put")
    .description("Write a file into /workspace")
    .argument("[space]", "Space name (defaults to config.defaultSpace)")
    .argument("<path>", "Path under /workspace (e.g. /hello.txt)")
    .option("--node <name>", "Node name from nodeMap (or full URL)")
    .option("--text <text>", "Text content to write")
    .option("--file <path>", "Read content from a local file")
    .option("--stdin", "Read content from stdin")
    .action(async (spaceArg: string | undefined, pathArg: string, options: { node?: string; text?: string; file?: string; stdin?: boolean }) => {
      try {
        const client = createClawdspaceClient({ config, node: options.node, logger });
        const space = resolveSpace(config, spaceArg);

        const content =
          options.stdin
            ? await readStdinText()
            : options.file
              ? fs.readFileSync(options.file, "utf8")
              : options.text ?? "";

        const contentBase64 = Buffer.from(content, "utf8").toString("base64");
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/file`, {
          method: "PUT",
          query: { path: pathArg },
          json: { contentBase64 },
        });
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(res, null, 2));
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
