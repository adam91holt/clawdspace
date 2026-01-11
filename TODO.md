# TODO (Clawdspace)

## Templates + Security
- Enforce per-template CIDR blocking (currently global baseline from `default` template): create dedicated Docker networks per template or per space and apply iptables rules per network.
- Add a hardened `readonly` template (set `security.writableRootfs: false`) for high-trust tasks.
- Add real UI validation feedback: return structured schema errors from API (zod issues) and show inline.

## Dashboard UX
- Replace free-text template field in Create modal with dropdown populated from `GET /api/templates`.
- Show template + network mode labels in space list/details.

## Git Workflow Hardening
- Add CLI wrapper for server-side push: `clawdspace git push --token-stdin` (calls `POST /api/spaces/:name/git/push`).
- Improve server-side git endpoint escaping and safety (avoid shell injection, validate repoPath, remote, branch; never log tokenized URLs).

## Networking
- Implement per-space network policy: `network.mode` (`none|internet|lan`) should apply even without GPU and even when no template is provided.
- Optional: domain allowlisting (GitHub-only) via proxy/DNS, not CIDRs.

## Observability
- Include effective template + network mode + readonly rootfs in `/observability` and/or space detail view.
