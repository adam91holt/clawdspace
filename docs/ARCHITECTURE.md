# Architecture

## High-level

```mermaid
flowchart LR
  UI[Web Dashboard] -->|REST + WS| API[Clawdspace API]
  API -->|Docker socket| DOCKER[Docker Engine]
  DOCKER -->|containers| SPACE[Spaces]
  DOCKER -->|named volumes| VOL[Per-space volumes (/workspace)]

  API -->|tailscale status| TS[Tailscale]
  API -->|cached probe| NODES[Other nodes]

  API --> AUDIT[Audit JSONL]
  SPACE -->|bash history| VOL
  API -->|ingest .bash_history| AUDIT
```

## Key ideas

- Each space is a Docker container named `clawdspace-<name>`.
- Each space has a Docker named volume `clawdspace-vol-<name>` mounted at `/workspace`.
- Containers run with least privilege by default (no-new-privileges, cap-drop, readonly rootfs + tmpfs).
- Auto-sleep pauses inactive containers to reduce resource usage.
- Nodes are discovered through Tailscale and cached in-process (fast dashboard loads).

## Terminal + history

- Terminal is `docker exec` over WebSocket.
- Terminal runs `bash -l`.
- The sandbox image config writes bash history to `/workspace/.bash_history` with epoch timestamps.
- The API ingests bash history periodically and emits `space.shell` audit events.
