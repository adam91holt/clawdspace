# Usage

This doc is a practical “day 2” guide for running Clawdspace.

## Concepts

- **Node**: a machine running the Clawdspace API (port `7777`).
- **Space**: a Docker container + a persistent `/workspace` volume.
- **Templates**: named presets for spaces (resources, image, network mode, rootfs).

## Common workflows

### Create a CPU space

```bash
clawdspace create my-space --memory 4g --cpus 2
```

### Create a GPU space

```bash
clawdspace create my-gpu-space --gpu --memory 16g --cpus 6
```

If you want GPU spaces to use the GPU image by default, set on the node:

```bash
export CLAWDSPACE_GPU_IMAGE=clawdspace-gpu:latest
```

### List spaces

```bash
clawdspace list
```

### Exec a command

```bash
clawdspace exec my-space "uname -a"
```

### Start/stop (pause)

```bash
clawdspace stop my-space
clawdspace start my-space
```

### Destroy a space

```bash
clawdspace destroy my-space
```

## Create spaces from templates

Templates let you standardize things like:
- default CPU/memory
- base image
- network restrictions

Example:

```bash
clawdspace create dev --template default
```

List templates:

```bash
clawdspace templates list
```

(If your CLI doesn’t expose templates yet, you can still use the API: `GET /api/templates`.)

## Clone a repo on create (API)

The API supports cloning a repo into the new space on creation.

```bash
curl -H "Authorization: Bearer $CLAWDSPACE_KEY" \
  -X POST "http://localhost:7777/api/spaces" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "repo-dev",
    "template": "default",
    "repoUrl": "https://github.com/your-org/your-repo.git",
    "repoBranch": "main",
    "repoDest": "repo",
    "env": { "GITHUB_TOKEN": "..." }
  }'
```

## Write an env file into /workspace (API)

Useful for `.env` bootstrapping:

```bash
curl -H "Authorization: Bearer $CLAWDSPACE_KEY" \
  -X POST "http://localhost:7777/api/spaces" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "env-dev",
    "envFileText": "FOO=bar\n",
    "envFilePath": "/workspace/.env"
  }'
```

## Push code from inside a space (API)

If a space has a repo checked out at `/workspace/repo`, you can trigger a push from the node:

```bash
curl -H "Authorization: Bearer $CLAWDSPACE_KEY" \
  -X POST "http://localhost:7777/api/spaces/env-dev/git/push" \
  -H "Content-Type: application/json" \
  -d '{"repoPath":"/repo","remote":"origin","branch":"main","token":"ghp_..."}'
```

This avoids leaving a long-lived token in the container filesystem.

## Hugging Face quick test (open model)

This avoids gated models that require an HF token.

1) Create a GPU space:

```bash
clawdspace create hf-open-smoke --gpu --memory 16g --cpus 6
```

2) Install deps:

```bash
clawdspace exec hf-open-smoke "python3 -m pip -q install --no-cache-dir transformers==4.41.2 accelerate==0.33.0 sentencepiece==0.2.0"
```

3) Run an open small model:

```bash
clawdspace exec hf-open-smoke "python3 -c 'import torch; from transformers import AutoTokenizer, AutoModelForCausalLM; mid=\"distilgpt2\"; tok=AutoTokenizer.from_pretrained(mid); m=AutoModelForCausalLM.from_pretrained(mid); dev=\"cuda\" if torch.cuda.is_available() else \"cpu\"; m=m.to(dev); inp=tok(\"Tell me a short story about a helpful shark AI\", return_tensors=\"pt\"); inp={k:v.to(dev) for k,v in inp.items()}; out=m.generate(**inp, max_new_tokens=120, do_sample=True, temperature=0.9, top_p=0.95); print(tok.decode(out[0], skip_special_tokens=True))'"
```

If you see JSON errors when passing multiline commands, see `docs/TROUBLESHOOTING.md`.

## Security checklist (minimum)

- Restrict API access (best: Tailscale-only).
- Use a strong `API_KEY` and treat it like a root credential.
- Treat templates + network mode as part of your sandbox posture (e.g. disable network for untrusted code).
- Don’t run untrusted code in spaces unless you’ve locked down networking and permissions.
