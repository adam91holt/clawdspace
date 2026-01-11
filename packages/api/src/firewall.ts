import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type FirewallRuleSet = {
  name: string;
  blockCidrs: string[];
};

const CHAIN = 'CLAWDSPACE_EGRESS';

function uniqCidrs(cidrs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of cidrs.map(s => s.trim()).filter(Boolean)) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

async function iptables(args: string[]): Promise<void> {
  await execFileAsync('iptables', args, { timeout: 8000 });
}

async function iptablesCheck(args: string[]): Promise<boolean> {
  try {
    await execFileAsync('iptables', args, { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureEgressFirewall({ blockCidrs }: FirewallRuleSet): Promise<void> {
  const cidrs = uniqCidrs(blockCidrs);

  // If iptables isn't available, skip.
  const hasIpt = await iptablesCheck(['-V']);
  if (!hasIpt) return;

  // Create chain if missing.
  const chainExists = await iptablesCheck(['-S', CHAIN]);
  if (!chainExists) {
    await iptables(['-N', CHAIN]);
  }

  // Ensure chain is jumped from DOCKER-USER (recommended hook).
  const jumpExists = await iptablesCheck(['-C', 'DOCKER-USER', '-j', CHAIN]);
  if (!jumpExists) {
    try {
      await iptables(['-I', 'DOCKER-USER', '1', '-j', CHAIN]);
    } catch {
      // ignore
    }
  }

  // Reset chain.
  try {
    await iptables(['-F', CHAIN]);
  } catch {
    // ignore
  }

  // Always allow established.
  await iptables(['-A', CHAIN, '-m', 'conntrack', '--ctstate', 'ESTABLISHED,RELATED', '-j', 'RETURN']);

  // Block configured CIDRs.
  for (const c of cidrs) {
    await iptables(['-A', CHAIN, '-d', c, '-j', 'REJECT']);
  }

  // Default: allow.
  await iptables(['-A', CHAIN, '-j', 'RETURN']);
}
