# Usage

This doc is a practical “day 2” guide for running Clawdspace.

## Concepts

- **Node**: a machine running the Clawdspace API (port `7777`).
- **Space**: a Docker container + a persistent `/workspace` volume.
- **Templates**: named presets for spaces (resources, image, network mode).

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
- Don’t run untrusted code in spaces unless you’ve locked down networking and permissions.
