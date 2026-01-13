import { Type } from "@sinclair/typebox";

import { clawdspaceConfigSchema, type ClawdspaceConfig } from "./src/config.js";
import { createClawdspaceClient } from "./src/client.js";
import { registerClawdspaceCli } from "./src/cli.js";
import { resolveSpace } from "./src/policy.js";

const ClawdspaceToolSchema = Type.Union([
  Type.Object({ action: Type.Literal("health"), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("system"), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("capabilities"), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("nodes"), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("list_spaces"), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("templates_list"), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("templates_get"), name: Type.String(), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("space_stats"), space: Type.Optional(Type.String()), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("space_observability"), space: Type.Optional(Type.String()), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("templates_put"), yaml: Type.String(), node: Type.Optional(Type.String()) }),
  Type.Object({ action: Type.Literal("templates_delete"), name: Type.String(), node: Type.Optional(Type.String()) }),
  Type.Object({
    action: Type.Literal("create_space"),
    name: Type.String(),
    template: Type.Optional(Type.String()),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("exec"),
    space: Type.Optional(Type.String()),
    command: Type.String(),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("files_list"),
    space: Type.Optional(Type.String()),
    path: Type.Optional(Type.String()),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("files_get"),
    space: Type.Optional(Type.String()),
    path: Type.String(),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("files_put"),
    space: Type.Optional(Type.String()),
    path: Type.String(),
    content: Type.String(),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("start_space"),
    space: Type.Optional(Type.String()),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("stop_space"),
    space: Type.Optional(Type.String()),
    node: Type.Optional(Type.String()),
  }),
  Type.Object({
    action: Type.Literal("destroy_space"),
    space: Type.Optional(Type.String()),
    node: Type.Optional(Type.String()),
    removeVolume: Type.Optional(Type.Boolean()),
  }),
  Type.Object({
    action: Type.Literal("audit"),
    space: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
    node: Type.Optional(Type.String()),
  }),
]);

const clawdspacePlugin = {
  id: "clawdspace",
  name: "Clawdspace",
  description: "Control Clawdspace sandboxes (spaces, exec, files, nodes)",
  configSchema: clawdspaceConfigSchema,
  register(api) {
    const cfg: ClawdspaceConfig = clawdspaceConfigSchema.parse(api.pluginConfig);

    const ensureEnabled = () => {
      if (!cfg.enabled) throw new Error("Clawdspace plugin disabled in config");
    };

    const json = (payload: unknown) => ({
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      details: payload,
    });

    const getClient = (node?: string) =>
      createClawdspaceClient({ config: cfg, node, logger: api.logger });

    const safeError = (err: unknown) =>
      err instanceof Error ? err.message : String(err);

    // RPC methods
    api.registerGatewayMethod("clawdspace.health", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/health");
        respond(true, { baseUrl: client.baseUrl, ...(res as any) });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.system", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/system");
        respond(true, { baseUrl: client.baseUrl, system: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.capabilities", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/system/capabilities");
        respond(true, { baseUrl: client.baseUrl, capabilities: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.nodes", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/nodes");
        respond(true, { baseUrl: client.baseUrl, nodes: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.templates.list", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/templates");
        respond(true, { baseUrl: client.baseUrl, templates: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.templates.get", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const name = typeof params?.name === "string" ? params.name.trim() : "";
        if (!name) {
          respond(false, { error: "name required" });
          return;
        }
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request(`/api/templates/${encodeURIComponent(name)}`, { method: "GET" });
        respond(true, { baseUrl: client.baseUrl, template: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.templates.put", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const yaml = typeof params?.yaml === "string" ? params.yaml : "";
        if (!yaml.trim()) {
          respond(false, { error: "yaml required" });
          return;
        }
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/templates", { method: "PUT", json: { yaml } });
        respond(true, { baseUrl: client.baseUrl, result: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.templates.delete", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const name = typeof params?.name === "string" ? params.name.trim() : "";
        if (!name) {
          respond(false, { error: "name required" });
          return;
        }
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request(`/api/templates/${encodeURIComponent(name)}`, { method: "DELETE" });
        respond(true, { baseUrl: client.baseUrl, result: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.list", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const res = await client.request("/api/spaces");
        respond(true, { baseUrl: client.baseUrl, spaces: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.create", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const name = typeof params?.name === "string" ? params.name.trim() : "";
        if (!name) {
          respond(false, { error: "name required" });
          return;
        }

        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const template = typeof params?.template === "string" ? params.template.trim() : undefined;
        const payload: Record<string, unknown> = { name };
        if (template) payload.template = template;

        const res = await client.request("/api/spaces", { method: "POST", json: payload });
        respond(true, { baseUrl: client.baseUrl, created: true, result: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    const spaceAction = (action: string, pathSuffix: string) => {
      api.registerGatewayMethod(`clawdspace.spaces.${action}`, async ({ params, respond }) => {
        try {
          ensureEnabled();
          const client = getClient(typeof params?.node === "string" ? params.node : undefined);
          const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
          const res = await client.request(
            `/api/spaces/${encodeURIComponent(space)}/${pathSuffix}`,
            { method: "POST" },
          );
          respond(true, { baseUrl: client.baseUrl, space, result: res });
        } catch (err) {
          respond(false, { error: safeError(err) });
        }
      });
    };

    spaceAction("start", "start");
    spaceAction("stop", "stop");

    api.registerGatewayMethod("clawdspace.spaces.destroy", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const removeVolume = String(params?.removeVolume || "false") === "true";
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}`, {
          method: "DELETE",
          query: { removeVolume: removeVolume ? "true" : undefined },
        });
        respond(true, { baseUrl: client.baseUrl, space, result: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.stats", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/stats`, { method: "GET" });
        respond(true, { baseUrl: client.baseUrl, space, stats: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.observability", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/observability`, { method: "GET" });
        respond(true, { baseUrl: client.baseUrl, space, observability: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.exec", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const command = typeof params?.command === "string" ? params.command : "";
        if (!command.trim()) {
          respond(false, { error: "command required" });
          return;
        }
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/exec`, {
          method: "POST",
          json: { command },
        });
        respond(true, { baseUrl: client.baseUrl, space, result: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.files.list", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const p = typeof params?.path === "string" ? params.path : "/";
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/files`, {
          method: "GET",
          query: { path: p },
        });
        respond(true, { baseUrl: client.baseUrl, space, path: p, files: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.files.get", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const p = typeof params?.path === "string" ? params.path : "";
        if (!p) {
          respond(false, { error: "path required" });
          return;
        }

        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/file`, {
          method: "GET",
          query: { path: p },
        });
        respond(true, { baseUrl: client.baseUrl, space, path: p, file: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.spaces.files.put", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space = resolveSpace(cfg, typeof params?.space === "string" ? params.space : undefined);
        const p = typeof params?.path === "string" ? params.path : "";
        const content = typeof params?.content === "string" ? params.content : "";
        if (!p) {
          respond(false, { error: "path required" });
          return;
        }
        const bytes = Buffer.byteLength(content, "utf8");
        if (bytes > cfg.maxFileBytes) {
          respond(false, { error: `content too large (${bytes} bytes > ${cfg.maxFileBytes})` });
          return;
        }

        const contentBase64 = Buffer.from(content, "utf8").toString("base64");
        const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/file`, {
          method: "PUT",
          query: { path: p },
          json: { contentBase64 },
        });
        respond(true, { baseUrl: client.baseUrl, space, path: p, result: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    api.registerGatewayMethod("clawdspace.audit.get", async ({ params, respond }) => {
      try {
        ensureEnabled();
        const client = getClient(typeof params?.node === "string" ? params.node : undefined);
        const space =
          typeof params?.space === "string" && params.space.trim()
            ? resolveSpace(cfg, params.space)
            : undefined;
        const limit = typeof params?.limit === "number" ? params.limit : 200;

        const res = await client.request("/api/audit", {
          method: "GET",
          query: {
            limit,
            ...(space ? { space } : {}),
          },
        });

        respond(true, { baseUrl: client.baseUrl, space, limit, audit: res });
      } catch (err) {
        respond(false, { error: safeError(err) });
      }
    });

    // Agent tool
    api.registerTool({
      name: "clawdspace",
      label: "Clawdspace",
      description: "Run isolated commands and manage sandboxes via Clawdspace.",
      parameters: ClawdspaceToolSchema,
      async execute(_toolCallId, params) {
        try {
          ensureEnabled();

          const node = typeof (params as any).node === "string" ? (params as any).node : undefined;
          const client = getClient(node);

          switch ((params as any).action) {
            case "health": {
              const res = await client.request("/api/health");
              return json({ baseUrl: client.baseUrl, ...(res as any) });
            }
            case "system": {
              const res = await client.request("/api/system");
              return json({ baseUrl: client.baseUrl, system: res });
            }
            case "capabilities": {
              const res = await client.request("/api/system/capabilities");
              return json({ baseUrl: client.baseUrl, capabilities: res });
            }
            case "nodes": {
              const res = await client.request("/api/nodes");
              return json({ baseUrl: client.baseUrl, nodes: res });
            }
            case "templates_list": {
              const res = await client.request("/api/templates");
              return json({ baseUrl: client.baseUrl, templates: res });
            }
            case "templates_get": {
              const name = String((params as any).name || "").trim();
              if (!name) throw new Error("name required");
              const res = await client.request(`/api/templates/${encodeURIComponent(name)}`, {
                method: "GET",
              });
              return json({ baseUrl: client.baseUrl, template: res });
            }
            case "templates_put": {
              const yaml = String((params as any).yaml || "");
              if (!yaml.trim()) throw new Error("yaml required");
              const res = await client.request("/api/templates", {
                method: "PUT",
                json: { yaml },
              });
              return json({ baseUrl: client.baseUrl, result: res });
            }
            case "templates_delete": {
              const name = String((params as any).name || "").trim();
              if (!name) throw new Error("name required");
              const res = await client.request(`/api/templates/${encodeURIComponent(name)}`, {
                method: "DELETE",
              });
              return json({ baseUrl: client.baseUrl, result: res });
            }
            case "list_spaces": {
              const res = await client.request("/api/spaces");
              return json({ baseUrl: client.baseUrl, spaces: res });
            }
            case "space_stats": {
              const space = resolveSpace(cfg, (params as any).space);
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/stats`, {
                method: "GET",
              });
              return json({ baseUrl: client.baseUrl, space, stats: res });
            }
            case "space_observability": {
              const space = resolveSpace(cfg, (params as any).space);
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/observability`, {
                method: "GET",
              });
              return json({ baseUrl: client.baseUrl, space, observability: res });
            }
            case "create_space": {
              const name = String((params as any).name || "").trim();
              if (!name) throw new Error("name required");
              const template =
                typeof (params as any).template === "string"
                  ? (params as any).template.trim()
                  : undefined;
              const payload: Record<string, unknown> = { name };
              if (template) payload.template = template;
              const res = await client.request("/api/spaces", {
                method: "POST",
                json: payload,
              });
              return json({ baseUrl: client.baseUrl, created: true, result: res });
            }
            case "exec": {
              const space = resolveSpace(cfg, (params as any).space);
              const command = String((params as any).command || "");
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/exec`, {
                method: "POST",
                json: { command },
              });
              return json({ baseUrl: client.baseUrl, space, result: res });
            }
            case "files_list": {
              const space = resolveSpace(cfg, (params as any).space);
              const p =
                typeof (params as any).path === "string"
                  ? (params as any).path
                  : "/";
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/files`, {
                method: "GET",
                query: { path: p },
              });
              return json({ baseUrl: client.baseUrl, space, path: p, files: res });
            }
            case "files_get": {
              const space = resolveSpace(cfg, (params as any).space);
              const p = String((params as any).path || "");
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/file`, {
                method: "GET",
                query: { path: p },
              });

              const contentBase64 = (res as any)?.contentBase64;
              let contentText: string | undefined;
              if (typeof contentBase64 === "string" && contentBase64) {
                try {
                  const buf = Buffer.from(contentBase64, "base64");
                  const decoded = buf.toString("utf8");
                  // Only include a small preview in-band.
                  contentText =
                    decoded.length > 10_000
                      ? decoded.slice(0, 10_000) + "\n…(truncated)"
                      : decoded;
                } catch {
                  // ignore
                }
              }

              return json({ baseUrl: client.baseUrl, space, path: p, file: res, contentText });
            }
            case "files_put": {
              const space = resolveSpace(cfg, (params as any).space);
              const p = String((params as any).path || "");
              const content = String((params as any).content || "");
              const bytes = Buffer.byteLength(content, "utf8");
              if (bytes > cfg.maxFileBytes) {
                throw new Error(
                  `content too large (${bytes} bytes > ${cfg.maxFileBytes})`,
                );
              }

              const contentBase64 = Buffer.from(content, "utf8").toString("base64");
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/file`, {
                method: "PUT",
                query: { path: p },
                json: { contentBase64 },
              });
              return json({ baseUrl: client.baseUrl, space, path: p, result: res });
            }
            case "start_space": {
              const space = resolveSpace(cfg, (params as any).space);
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/start`, {
                method: "POST",
              });
              return json({ baseUrl: client.baseUrl, space, result: res });
            }
            case "stop_space": {
              const space = resolveSpace(cfg, (params as any).space);
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}/stop`, {
                method: "POST",
              });
              return json({ baseUrl: client.baseUrl, space, result: res });
            }
            case "destroy_space": {
              const space = resolveSpace(cfg, (params as any).space);
              const removeVolume = (params as any).removeVolume === true;
              const res = await client.request(`/api/spaces/${encodeURIComponent(space)}`, {
                method: "DELETE",
                query: { removeVolume: removeVolume ? "true" : undefined },
              });
              return json({ baseUrl: client.baseUrl, space, result: res });
            }
            case "audit": {
              const space =
                typeof (params as any).space === "string" && (params as any).space.trim()
                  ? resolveSpace(cfg, (params as any).space)
                  : undefined;
              const limit =
                typeof (params as any).limit === "number" ? (params as any).limit : 200;
              const res = await client.request("/api/audit", {
                method: "GET",
                query: { ...(space ? { space } : {}), limit },
              });
              return json({ baseUrl: client.baseUrl, space, limit, audit: res });
            }
          }

          throw new Error(`Unknown action: ${(params as any).action}`);
        } catch (err) {
          return json({ error: safeError(err) });
        }
      },
    });

    api.registerCli(
      ({ program }) => registerClawdspaceCli({ program, config: cfg, logger: api.logger }),
      { commands: ["clawdspace"] },
    );

    api.registerService({
      id: "clawdspace",
      start: async () => {
        if (!cfg.enabled) return;
        // Best-effort probe for early visibility.
        try {
          const client = getClient();
          await client.request("/api/health");
          api.logger.info(`[clawdspace] ready (${client.baseUrl})`);
        } catch (err) {
          api.logger.warn(`[clawdspace] not ready: ${safeError(err)}`);
        }
      },
      stop: async () => {},
    });
  },
};

export default clawdspacePlugin;
