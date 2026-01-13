# Architecture

## High-level

```mermaid
flowchart LR
  %% Clients
  AGENT[Clawdbot Agent] -->|tool call: clawdspace| PLUGIN[Clawdspace Extension (Clawdbot)]
  CLI[clawdspace CLI] -->|REST| API
  UI[Web Dashboard] -->|REST| API
  UI -->|WebSocket terminal| API

  %% Clawdbot side
  PLUGIN -->|REST (API key)| API

  %% Clawdspace node
  API[Clawdspace API] -->|Docker socket| DOCKER[Docker Engine]
  DOCKER -->|containers| SPACE[Spaces]
  DOCKER -->|named volumes| VOL[Per-space volumes]

  API -->|tailscale status| TS[Tailscale]
  API -->|cached probe| NODES[Other nodes]

  API --> AUDIT[Audit JSONL]
  SPACE -->|bash history| VOL
  API -->|ingest .bash_history| AUDIT

  API -->|optional| FW[Host egress firewall]
```

## Clawdbot plugin fit

- The Clawdbot extension (snapshot in `clawdbot/plugins/clawdspace/`) registers the `clawdspace` tool.
- Tool actions (e.g. `create_space`, `exec`, `files_get/put`, `list_spaces`, `templates_*`) are translated into HTTP calls to the Clawdspace API (`/api/...`).
- This gives agents a first-class “sandbox primitive” without needing SSH or the local `clawdspace` CLI.

## Key ideas

- Each space is a Docker container named `clawdspace-<name>`.
- Each space has a Docker named volume `clawdspace-vol-<name>` mounted at `/workspace`.
- Containers run with least privilege by default (no-new-privileges, cap-drop, readonly rootfs + tmpfs).
- Auto-sleep pauses inactive containers to reduce resource usage.
- Nodes are discovered through Tailscale and cached in-process (fast dashboard loads).
- Templates provide opinionated defaults (resources, image, network mode, rootfs behavior).

## Control planes

- **REST API**: `/api/*` for spaces, templates, files, stats, audit.
- **WebSocket terminal**: `/api/spaces/:name/terminal` runs `bash -l` inside the container.

## Repo operations

- Repo clone is supported during space creation (`POST /api/spaces` with `repoUrl` / `repoBranch` / `repoDest`).
- Server-side git push is supported via `POST /api/spaces/:name/git/push` (token passed in request body; not persisted).

## Terminal + history

- Terminal is `docker exec` over WebSocket.
- Terminal runs `bash -l`.
- The sandbox image config writes bash history to `/workspace/.bash_history` with epoch timestamps.
- The API ingests bash history periodically and emits `space.shell` audit events.
