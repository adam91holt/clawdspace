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

## Spaces

### List spaces

```http
GET /api/spaces
```

### Create space

```http
POST /api/spaces
```

Body:

```json
{
  "name": "my-space",
  "memory": "2g",
  "cpus": 1,
  "gpu": false,
  "image": "clawdspace:latest"
}
```

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

### Stats

```http
GET /api/spaces/:name/stats
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

## Audit

```http
GET /api/audit?space=my-space&limit=200
```

Events include:
- `space.create`, `space.start`, `space.pause`, `space.destroy`
- `space.exec` (API exec command)
- `space.shell` (ingested from `/workspace/.bash_history`)
- `terminal.open`, `terminal.close`

## Health

```http
GET /api/health
```
