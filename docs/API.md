# Clawdspace API

Base URL:

```
http://your-server:7777/api
```

## Auth

The server accepts either:

1) **Query param** (recommended for browsers):

```
GET /api/spaces?key=YOUR_API_KEY
```

2) **Authorization header** (recommended for scripts):

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:7777/api/spaces
```

Disable auth entirely (dev only): set `CLAWDSPACE_AUTH_DISABLED=true` on the node.

## Health

```http
GET /api/health
```

## System

```http
GET /api/system
GET /api/system/capabilities
```

## Nodes

Nodes are auto-discovered via Tailscale (unless `CLAWDSPACE_NODES` is set). The endpoint is cached server-side.

```http
GET /api/nodes
```

Response:

```json
{
  "nodes": [
    {
      "name": "rtx3090",
      "url": "http://rtx3090.tailnet.ts.net:7777",
      "status": "online",
      "latencyMs": 12,
      "capabilities": { "gpu": true, "gpuName": "NVIDIA GeForce RTX 3090" }
    }
  ],
  "lastUpdatedAt": 1730000000000
}
```

## Templates

Templates are named presets that can set defaults for:
- resources (cpu/memory/gpu/image)
- network mode (e.g. internet vs none)
- writable rootfs

```http
GET    /api/templates
GET    /api/templates/:name
PUT    /api/templates
DELETE /api/templates/:name
```

PUT body:

```json
{ "yaml": "name: my-template\nresources: ...\n" }
```

## Spaces

### List spaces

```http
GET /api/spaces
```

### Create space

```http
POST /api/spaces
```

Body (core fields):

```json
{
  "name": "my-space",
  "memory": "2g",
  "cpus": 1,
  "gpu": false,
  "image": "clawdspace:latest",
  "template": "default"
}
```

Body (optional conveniences):
- `env` (object): environment variables for the space process
- `envFileText` or `envFileBase64` + `envFilePath`: write an env file into `/workspace`
- `repoUrl`, `repoBranch`, `repoDest`: clone a repo into `/workspace/<repoDest>` on create

Notes:
- If the selected template disables networking, repo cloning will be rejected.
- For private GitHub HTTPS repos, you can provide `env.GITHUB_TOKEN` (PAT) or rely on the node’s `gh auth` token.

### Get space

```http
GET /api/spaces/:name
```

### Delete space

```http
DELETE /api/spaces/:name?removeVolume=false
```

### Pause / resume

```http
POST /api/spaces/:name/stop
POST /api/spaces/:name/start
```

### Exec

```http
POST /api/spaces/:name/exec
```

Body:

```json
{ "command": "python3 --version" }
```

### Terminal (WebSocket)

Interactive terminal is a websocket that runs `bash -l` inside the container:

```http
GET /api/spaces/:name/terminal
```

### Stats

```http
GET /api/spaces/:name/stats
```

### Observability

```http
GET /api/spaces/:name/observability
```

### Files (scoped to /workspace)

```http
GET /api/spaces/:name/files?path=/
GET /api/spaces/:name/file?path=/hello.txt
PUT /api/spaces/:name/file?path=/hello.txt
```

Write body:

```json
{ "contentBase64": "aGkK" }
```

### Git push (server-side)

This is for pushing changes from inside a space without exposing a long-lived token inside the container.

```http
POST /api/spaces/:name/git/push
```

Body:

```json
{
  "repoPath": "/repo",
  "remote": "origin",
  "branch": "main",
  "token": "ghp_..."
}
```

## Audit

```http
GET /api/audit?space=my-space&limit=200
```

Events include:
- `space.create`, `space.start`, `space.pause`, `space.destroy`
- `space.exec` (API exec command)
- `space.shell` (ingested from `/workspace/.bash_history`)
- `terminal.open`, `terminal.close`
- `template.upsert`, `template.delete`
