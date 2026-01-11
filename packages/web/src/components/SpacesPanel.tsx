import { useMemo, useState } from 'react';
import { Space } from '../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
}

function formatDate(str: string): string {
  if (!str) return '-';
  const diff = Date.now() - new Date(str).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(str).toLocaleDateString();
}

function statusLabel(s: Space['status']): string {
  if (s === 'running') return 'running';
  if (s === 'paused') return 'paused';
  return 'stopped';
}

export function SpacesPanel({
  spaces,
  onCreate,
  onExec,
  onTerminal,
  onFiles,
  onStats,
  onStop,
  onStart,
  onDestroy,
  onPauseAll
}: {
  spaces: Space[];
  onCreate: () => void;
  onExec: (name: string) => void;
  onTerminal: (name: string) => void;
  onFiles: (name: string) => void;
  onStats: (name: string) => void;
  onStop: (name: string) => void;
  onStart: (name: string) => void;
  onDestroy: (name: string) => void;
  onPauseAll: (names: string[]) => void;
}) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'running' | 'paused'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spaces.filter(s => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });
  }, [spaces, query, filter]);

  const summary = useMemo(() => {
    const running = spaces.filter(s => s.status === 'running').length;
    const paused = spaces.filter(s => s.status === 'paused').length;
    return { running, paused, total: spaces.length };
  }, [spaces]);

  const pauseAll = () => {
    const running = spaces.filter(s => s.status === 'running').map(s => s.name);
    if (running.length === 0) return;
    if (window.confirm(`Pause ${running.length} running spaces?`)) {
      onPauseAll(running);
    }
  };

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>⟩ Spaces</h2>
          <div className="text-muted text-sm" style={{ marginTop: 4 }}>
            {summary.total} total · {summary.running} running · {summary.paused} paused
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="segmented">
            <button className={`seg-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>Table</button>
            <button className={`seg-btn ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>Cards</button>
          </div>
          <div className="segmented">
            <button className={`seg-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`seg-btn ${filter === 'running' ? 'active' : ''}`} onClick={() => setFilter('running')}>Running</button>
            <button className={`seg-btn ${filter === 'paused' ? 'active' : ''}`} onClick={() => setFilter('paused')}>Paused</button>
          </div>
          <input
            className="search"
            placeholder="Search spaces…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" onClick={pauseAll} disabled={summary.running === 0}>Pause All</button>
          <button className="btn btn-primary" onClick={onCreate}>+ Create Space</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          No spaces match your filters.
        </div>
      ) : view === 'table' ? (
        <table className="spaces-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Resources</th>
              <th>Storage</th>
              <th>Created</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(space => (
              <tr key={space.name}>
                <td>
                  <strong>{space.name}</strong>
                  <br />
                  <span className="text-muted text-sm">{space.id}</span>
                </td>
                <td>
                  <span className={`status-badge status-${space.status}`}>
                    <span className="status-dot"></span>
                    {statusLabel(space.status)}
                  </span>
                </td>
                <td className="text-sm">
                  {space.cpus} CPU, {formatBytes(space.memory)}
                </td>
                <td className="text-sm text-muted">
                  {space.volume ? (
                    <span title={space.volume.name}>{space.volume.mountpoint}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="text-sm text-muted">{formatDate(space.created)}</td>
                <td className="text-sm text-muted">{formatDate(space.lastActivity)}</td>
                <td>
                  <div className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => onExec(space.name)}>Exec</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => onTerminal(space.name)}>Terminal</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => onFiles(space.name)}>Files</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => onStats(space.name)}>Stats</button>
                    {space.status === 'running' ? (
                      <button className="btn btn-sm btn-ghost" onClick={() => onStop(space.name)}>Pause</button>
                    ) : (
                      <button className="btn btn-sm btn-ghost" onClick={() => onStart(space.name)}>Start</button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => onDestroy(space.name)}>Destroy</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="space-cards">
          {filtered.map(s => (
            <div key={s.name} className="space-card">
              <div className="space-card-top">
                <div>
                  <div className="space-title">{s.name}</div>
                  <div className="space-sub">{s.id} · {formatBytes(s.memory)} · {s.cpus} CPU</div>
                </div>
                <span className={`status-badge status-${s.status}`}>
                  <span className="status-dot"></span>
                  {statusLabel(s.status)}
                </span>
              </div>

              <div className="space-card-meta">
                <div className="node-pill">storage: {s.volume ? s.volume.mountpoint : '-'}</div>
                <div className="node-pill">created: {formatDate(s.created)}</div>
                <div className="node-pill">last: {formatDate(s.lastActivity)}</div>
              </div>

              <div className="space-card-actions">
                <button className="btn btn-sm" onClick={() => onExec(s.name)}>Exec</button>
                <button className="btn btn-sm" onClick={() => onTerminal(s.name)}>Terminal</button>
                <button className="btn btn-sm" onClick={() => onFiles(s.name)}>Files</button>
                <button className="btn btn-sm" onClick={() => onStats(s.name)}>Stats</button>
                {s.status === 'running' ? (
                  <button className="btn btn-sm" onClick={() => onStop(s.name)}>Pause</button>
                ) : (
                  <button className="btn btn-sm" onClick={() => onStart(s.name)}>Start</button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => onDestroy(s.name)}>Destroy</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
