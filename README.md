# 🚀 Clawdspace

**Self-hosted sandboxed execution environments** — run isolated “spaces” on your own machines (Docker + Tailscale).

## Features

- 🐳 **Docker-based sandboxes** — isolated Linux env per space, persistent `/workspace` volume
- ⏸️ **Auto-sleep** — spaces pause after idle timeout (saves resources)
- 🌐 **Dashboard** — manage spaces, stats, files, terminal, audit log (mobile-friendly)
- 🧭 **Multi-node (Tailscale)** — auto-discovers nodes and shows cluster overview
- 🎮 **GPU support** — opt-in GPU spaces (where available)
- 📝 **Audit + history** — API command audit + bash history ingestion

## Quick Start (single node)

### 1) Clone + build

```bash
git clone https://github.com/adam91holt/clawdspace.git
cd clawdspace

# Build the sandbox image
docker build -t clawdspace:latest -f docker/Dockerfile .

# Install deps + build everything
npm ci
npm run build
```

### 2) Run the API server

```bash
cd packages/api
PORT=7777 API_KEY=your_key npm start
```

Dashboard: `http://localhost:7777`

## Authentication

The server supports either:
- Query param: `?key=YOUR_KEY` (recommended for browsers)
- Header: `Authorization: Bearer YOUR_KEY` (works for curl/CLI, but some browsers reject non-ASCII header values)

## Key API endpoints

- Spaces
  - `GET /api/spaces`
  - `POST /api/spaces`
  - `POST /api/spaces/:name/exec`
  - `GET /api/spaces/:name/stats`
  - `GET /api/spaces/:name/files?path=/`
  - `GET/PUT /api/spaces/:name/file?path=/foo.txt`
- Nodes
  - `GET /api/nodes` (cached; auto-discovered via Tailscale)
- Audit
  - `GET /api/audit?space=name&limit=200`

## Terminal

The dashboard exposes an interactive terminal over WebSocket:

- `GET /api/spaces/:name/terminal?key=YOUR_KEY`

The terminal uses `bash -l` and writes history to `/workspace/.bash_history`.

## Persistence model

Each space gets its own Docker named volume mounted at:
- `/workspace`

Stopping/pausing a space does **not** delete data.

## Docs

- `docs/API.md` — REST API reference
- `docs/ARCHITECTURE.md` — system design + mermaid diagrams
- `docs/CLI.md` — CLI reference

---

Built with 🦞 (a tiny nod to the crustacean army) — keep it local, keep it yours.
