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
API_KEY="clawdspace_sk_live_..." PORT=7777 node dist/index.js
```

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

## WSL notes

If you run a node in WSL:
- Make sure the process starts automatically.
- Prefer enabling systemd in WSL and installing a service.

