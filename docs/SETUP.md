# Setup

## Create an API key

Clawdspace currently uses a single shared API key string.

Generate one:

```bash
python3 - <<'PY'
import secrets
print('clawdspace_sk_live_' + secrets.token_hex(16))
PY
```

Set it when starting the API:

```bash
PORT=7777 API_KEY="clawdspace_sk_live_..." node dist/index.js
```

Dev only:

- Disable auth entirely: `CLAWDSPACE_AUTH_DISABLED=true`

## Build and run

### Build sandbox image

```bash
docker build -t clawdspace:latest -f docker/Dockerfile .
```

### Build API + Web

```bash
npm ci
npm run build
```

### Start API

```bash
cd packages/api
PORT=7777 API_KEY="<your_api_key>" node dist/index.js
```

## Multi-node with Tailscale

Clawdspace discovers nodes by reading `tailscale status --json` and probing each peer at port `7777`.

Requirements:
- Tailscale installed and running on every node
- The Clawdspace API running on each node
- **Same `API_KEY`** on all nodes

Optional overrides:

```
CLAWDSPACE_NODES=oracle=http://localhost:7777,rtx=http://rtx3090.tailnet.ts.net:7777
```

## Environment variables (node)

Common:
- `PORT` (default `7777`)
- `API_KEY` (default `clawdspace_dev_key`)
- `CLAWDSPACE_AUTH_DISABLED` (`true` disables auth; dev only)
- `IDLE_TIMEOUT_MS` (default `600000` / 10 minutes)
- `NODES_REFRESH_MS` (default `30000`)
- `HISTORY_INGEST_MS` (default `15000`)
- `CLAWDSPACE_NODES` (manual node list)

GPU defaults:
- `CLAWDSPACE_GPU_IMAGE` (default GPU image name)

## WSL notes

If you run a node in WSL:
- Make sure the process starts automatically.
- Prefer enabling systemd in WSL and installing a service.
