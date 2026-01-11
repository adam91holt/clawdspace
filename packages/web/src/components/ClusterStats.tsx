import { useMemo } from 'react';
import { NodeInfo } from '../types';

export function ClusterStats({ nodes }: { nodes: NodeInfo[] | null }) {
  const stats = useMemo(() => {
    if (!nodes) {
      return {
        online: 0,
        total: 0,
        gpuOnline: 0,
        gpuTypes: [] as string[]
      };
    }

    const onlineNodes = nodes.filter(n => n.status === 'online');
    const gpuOnline = onlineNodes.filter(n => n.capabilities?.gpu).length;
    const gpuNames = new Set<string>();
    for (const n of onlineNodes) {
      if (n.capabilities?.gpu && n.capabilities.gpuName) gpuNames.add(n.capabilities.gpuName);
    }

    return {
      online: onlineNodes.length,
      total: nodes.length,
      gpuOnline,
      gpuTypes: Array.from(gpuNames).slice(0, 4)
    };
  }, [nodes]);

  return (
    <section className="section" style={{ marginTop: 16 }}>
      <div className="section-header">
        <div>
          <h2>⟩ Cluster</h2>
          <div className="text-muted text-sm" style={{ marginTop: 4 }}>
            {nodes === null ? 'Loading…' : `${stats.online}/${stats.total} nodes online`}
          </div>
        </div>
      </div>

      <div className="cluster-grid">
        <div className="cluster-card">
          <div className="stat-label">Nodes</div>
          <div className="stat-value">{nodes === null ? '—' : `${stats.online}/${stats.total}`}</div>
        </div>
        <div className="cluster-card">
          <div className="stat-label">GPU Nodes</div>
          <div className="stat-value">{nodes === null ? '—' : `${stats.gpuOnline}`}</div>
        </div>
        <div className="cluster-card cluster-wide">
          <div className="stat-label">GPU Types</div>
          <div className="stat-value">
            {nodes === null ? '—' : (stats.gpuTypes.length ? stats.gpuTypes.join(', ') : 'None detected')}
          </div>
        </div>
      </div>
    </section>
  );
}
