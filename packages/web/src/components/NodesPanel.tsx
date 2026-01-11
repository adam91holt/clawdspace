import { useEffect, useState } from 'react';
import { api } from '../api';
import { NodeInfo } from '../types';

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

  return (
    <section className="section" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h2>⟩ Nodes</h2>
        <span className="text-muted text-sm">Tailscale auto-discovery</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {nodes === null ? (
        <div className="loading">Loading nodes…</div>
      ) : nodes.length === 0 ? (
        <div className="empty-state">
          No nodes found. Make sure Tailscale is running on this host, and other nodes are reachable on port 7777.
        </div>
      ) : (
        <table className="spaces-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>URL</th>
              <th>Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(n => (
              <tr key={n.name + n.url}>
                <td><strong>{n.name}</strong></td>
                <td>
                  <span className={`status-badge status-${n.status === 'online' ? 'running' : 'stopped'}`}>
                    <span className="status-dot"></span>
                    {n.status}
                  </span>
                </td>
                <td className="text-sm text-muted">{n.url}</td>
                <td className="text-sm">
                  {n.capabilities?.gpu ? (
                    <span>GPU {n.capabilities.gpuName ? `(${n.capabilities.gpuName})` : ''}</span>
                  ) : (
                    <span className="text-muted">CPU</span>
                  )}
                  {n.capabilities?.arch ? <span className="text-muted"> · {n.capabilities.arch}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
