import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { NodeInfo } from '../types';

function nodeBadge(node: NodeInfo): { label: string; className: string } {
  if (node.status === 'online') {
    return { label: 'online', className: 'status-running' };
  }
  return { label: 'offline', className: 'status-stopped' };
}

function capText(node: NodeInfo): string {
  const cap = node.capabilities;
  if (cap?.gpu) {
    return `GPU${cap.gpuName ? ` · ${cap.gpuName}` : ''}`;
  }
  return 'CPU';
}

function hostIcon(node: NodeInfo): string {
  if (node.capabilities?.gpu) return '🦞';
  return '🧠';
}

export function NodesPanel() {
  const [nodes, setNodes] = useState<NodeInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchNodes() {
      try {
        const res = await api.getNodes();
        if (!mounted) return;
        setNodes(res.nodes || []);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message);
        setNodes([]);
      }
    }

    fetchNodes();
    const t = setInterval(fetchNodes, 15000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const summary = useMemo(() => {
    if (!nodes) return { online: 0, total: 0 };
    const online = nodes.filter(n => n.status === 'online').length;
    return { online, total: nodes.length };
  }, [nodes]);

  const sorted = useMemo(() => {
    if (!nodes) return [];
    return [...nodes].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
      const agpu = a.capabilities?.gpu ? 1 : 0;
      const bgpu = b.capabilities?.gpu ? 1 : 0;
      if (agpu !== bgpu) return bgpu - agpu;
      const alat = a.latencyMs ?? 999999;
      const blat = b.latencyMs ?? 999999;
      if (alat !== blat) return alat - blat;
      return a.name.localeCompare(b.name);
    });
  }, [nodes]);

  return (
    <section className="section" style={{ marginTop: 16 }}>
      <div className="section-header">
        <div>
          <h2>⟩ Nodes</h2>
          <div className="text-muted text-sm" style={{ marginTop: 4 }}>
            {nodes === null ? 'Discovering via Tailscale…' : `${summary.online}/${summary.total} online · auto-discovery`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="text-muted text-sm">Tailscale</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {nodes === null ? (
        <div className="skeleton-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          No nodes found. Make sure Tailscale is running on this host, and other nodes are reachable on port 7777.
        </div>
      ) : (
        <div className="node-grid">
          {sorted.map((n) => {
            const badge = nodeBadge(n);
            return (
              <div key={n.name + n.url} className="node-card">
                <div className="node-title">
                  <div className="node-icon">{hostIcon(n)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="node-name">{n.name}</div>
                    <div className="node-url">{n.url}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span className={`status-badge ${badge.className}`}>
                      <span className="status-dot"></span>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="node-meta">
                  <div className="node-pill">{capText(n)}</div>
                  {typeof n.latencyMs === 'number' && (
                    <div className="node-pill">{n.latencyMs}ms</div>
                  )}
                  {n.capabilities?.arch && (
                    <div className="node-pill">{n.capabilities.arch}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
