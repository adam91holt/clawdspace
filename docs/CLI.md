# CLI

The CLI runs on your workstation and talks to the API server.

## Setup

Make sure you have an API key and the server URL.

## Commands

Typical flow:

```bash
clawdspace system
clawdspace create dev
clawdspace exec dev "python3 --version"
clawdspace stop dev
clawdspace start dev
clawdspace list
clawdspace destroy dev
```

## Notes

- For browser use, prefer `?key=...` auth (no header encoding issues).
- For scripts, `Authorization: Bearer ...` works.
