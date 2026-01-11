import { Space } from '../types';

interface Props {
  spaces: Space[];
  onExec: (name: string) => void;
  onTerminal: (name: string) => void;
  onFiles: (name: string) => void;
  onStats: (name: string) => void;
  onStop: (name: string) => void;
  onStart: (name: string) => void;
  onDestroy: (name: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
}

function formatDate(str: string): string {
  if (!str) return '-';
  const diff = Date.now() - new Date(str).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(str).toLocaleDateString();
}

export function SpaceList({ spaces, onExec, onTerminal, onFiles, onStats, onStop, onStart, onDestroy }: Props) {
  if (spaces.length === 0) {
    return (
      <div className="empty-state">
        No spaces yet. Create one to get started.
      </div>
    );
  }

  return (
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
        {spaces.map(space => (
          <tr key={space.name}>
            <td>
              <strong>{space.name}</strong>
              <br />
              <span className="text-muted text-sm">{space.id}</span>
            </td>
            <td>
              <span className={`status-badge status-${space.status}`}>
                <span className="status-dot"></span>
                {space.status}
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
                <button className="btn btn-sm btn-ghost" onClick={() => onExec(space.name)}>
                  Exec
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => onTerminal(space.name)}>
                  Terminal
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => onFiles(space.name)}>
                  Files
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => onStats(space.name)}>
                  Stats
                </button>
                {space.status === 'running' ? (
                  <button className="btn btn-sm btn-ghost" onClick={() => onStop(space.name)}>
                    Pause
                  </button>
                ) : (
                  <button className="btn btn-sm btn-ghost" onClick={() => onStart(space.name)}>
                    Start
                  </button>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => onDestroy(space.name)}>
                  Destroy
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
