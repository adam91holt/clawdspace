import { useEffect, useState } from 'react';
import { ModalShell } from './ModalShell';
import { api } from '../api';
import { SpaceStats } from '../types';

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function SpaceStatsModal({
  spaceName,
  onClose
}: {
  spaceName: string;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<SpaceStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const res = await api.getSpaceStats(spaceName);
        if (mounted) {
          setStats(res.stats);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError((e as Error).message);
      }
    }

    fetchStats();
    const t = setInterval(fetchStats, 2000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [spaceName]);

  return (
    <ModalShell
      title="Stats"
      subtitle={spaceName}
      onClose={onClose}
    >

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {!stats ? (
          <div className="loading">Loading stats...</div>
        ) : (
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
              <div className="stat-label">PIDs</div>
              <div className="stat-value">{stats.pids}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Network</div>
              <div className="stat-value">↓ {formatBytes(stats.networkRxBytes)} ↑ {formatBytes(stats.networkTxBytes)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Disk I/O</div>
              <div className="stat-value">R {formatBytes(stats.blockReadBytes)} W {formatBytes(stats.blockWriteBytes)}</div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
    </ModalShell>
  );
}
