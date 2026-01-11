# Troubleshooting

## CLI shows weird `[0;34m` color codes
The CLI uses ANSI color codes. If your terminal doesn’t render them, you’ll see raw escape sequences.

- Try a different terminal, or
- Disable color output (not currently supported in the bash CLI script), or
- Pipe through something that strips ANSI.

## `clawdspace exec` fails with: `Bad control character in string literal in JSON`
This happens when a command contains literal newlines and the CLI sends it as JSON.

Workarounds:
- Prefer one-liners: `python3 -c '...'`
- Or write a file then run it:
  - `clawdspace exec myspace "cat > /workspace/run.py <<'PY' ... PY"` (note: still newline-sensitive in some shells)
- Or base64-encode the payload and decode inside the container.

If you hit this frequently, the long-term fix is to update the CLI to JSON-escape newlines properly (or accept a `--stdin` / `--file` mode).

## Server discovery doesn’t find my node

### Common causes
- The API isn’t running on the node.
- Port `7777` isn’t reachable (firewall, not on Tailscale, wrong bind).
- Different `API_KEY` between nodes.

### Fix
- Confirm API health on the node:
  - `curl http://<node>:7777/api/health`
- Confirm key works:
  - `curl -H "Authorization: Bearer $CLAWDSPACE_KEY" http://<node>:7777/api/system`
- Force discovery override:
  - `CLAWDSPACE_NODES=rtx3090=http://100.64.248.29:7777` (comma-separated list)

## GPU spaces don’t get a GPU

### Checklist
- Confirm host has NVIDIA drivers + NVIDIA Container Toolkit.
- Confirm Docker can see GPUs:
  - `docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi`
- Confirm Clawdspace GPU image exists on the node:
  - `docker images | grep clawdspace-gpu`

### Clawdspace-specific
- Prefer using the GPU image template: `clawdspace-gpu:latest`.
- Set default GPU image on API host:
  - `CLAWDSPACE_GPU_IMAGE=clawdspace-gpu:latest`

## Spaces stuck in `paused`
Pausing is how Clawdspace “auto-sleeps”.

- Resume:
  - `clawdspace start <space>`

## Can’t modify the API systemd service
If the service is installed as a system service (e.g. `/etc/systemd/system/clawdspace.service`), you’ll need sudo to change env vars like `CLAWDSPACE_GPU_IMAGE`.

Options:
- Ask an admin to edit/restart the service.
- Use a user service (`systemctl --user ...`) if that’s how you prefer to run it.
