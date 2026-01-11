import { useEffect, useState } from 'react';
import { ModalShell } from './ModalShell';
import { api } from '../api';
import { SpaceObservability } from '../types';

function formatBytes(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function ObservabilityModal({
  spaceName,
  onClose
}: {
  spaceName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<SpaceObservability | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchObs() {
      try {
        const res = await api.getSpaceObservability(spaceName);
        if (!mounted) return;
        setData(res.observability);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message);
      }
    }

    fetchObs();
    const t = setInterval(fetchObs, 3000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [spaceName]);

  const stats = data?.stats;

  return (
    <ModalShell title="Observability" subtitle={spaceName} onClose={onClose} wide>
      {error && <div className="alert alert-error">{error}</div>}

      {!data || !stats ? (
        <div className="loading">Loading…</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">CPU</div>
              <div className="stat-value">{stats.cpuPercent.toFixed(1)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Memory</div>
              <div className="stat-value">
                {formatBytes(stats.memoryUsageBytes)} / {formatBytes(stats.memoryLimitBytes)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Workspace Used</div>
              <div className="stat-value">
                {formatBytes(data.workspaceSizeBytes)}
                {data.workspaceDisk?.usedPercent != null ? ` (${data.workspaceDisk.usedPercent.toFixed(1)}%)` : ''}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">PIDs</div>
              <div className="stat-value">{stats.pids}</div>
            </div>
          </div>

          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="panel">
              <div className="panel-title">Top CPU</div>
              {data.top && data.top.length ? (
                <table className="spaces-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>PID</th>
                      <th>%CPU</th>
                      <th>%MEM</th>
                      <th>ETIME</th>
                      <th>CMD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top.map((p) => (
                      <tr key={p.pid}>
                        <td className="text-sm">{p.pid}</td>
                        <td className="text-sm">{p.cpu.toFixed(1)}</td>
                        <td className="text-sm">{p.mem.toFixed(1)}</td>
                        <td className="text-sm text-muted">{p.etime}</td>
                        <td className="text-sm">{p.command}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No processes found.</div>
              )}
            </div>

            <div className="panel">
              <div className="panel-title">.bash_history (tail)</div>
              <pre className="code" style={{ marginTop: 10, maxHeight: 280, overflow: 'auto' }}>
{data.bashHistoryTail || '(no history yet)'}
              </pre>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
