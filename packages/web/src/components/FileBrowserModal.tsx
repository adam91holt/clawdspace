import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { FileEntry } from '../types';

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

function joinPath(a: string, b: string): string {
  const base = a.endsWith('/') ? a.slice(0, -1) : a;
  const next = b.startsWith('/') ? b : '/' + b;
  const out = (base + next).replace(/\/+/g, '/');
  return out === '' ? '/' : out;
}

export function FileBrowserModal({
  spaceName,
  onClose
}: {
  spaceName: string;
  onClose: () => void;
}) {
  const [path, setPath] = useState<string>('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [{ label: '/', path: '/' }];
    let cur = '';
    for (const p of parts) {
      cur = cur + '/' + p;
      crumbs.push({ label: p, path: cur });
    }
    return crumbs;
  }, [path]);

  async function refresh(targetPath: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listFiles(spaceName, targetPath);
      setPath(res.path);
      setEntries(res.entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceName]);

  const dirs = entries.filter(e => e.type === 'dir');
  const files = entries.filter(e => e.type !== 'dir');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Files: {spaceName} <span className="muted">(workspace)</span></h3>
          <button className="btn btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="breadcrumbs">
          {breadcrumb.map((c, i) => (
            <button
              key={c.path}
              className={`crumb ${i === breadcrumb.length - 1 ? 'active' : ''}`}
              onClick={() => refresh(c.path)}
            >
              {c.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => refresh(path)} disabled={loading}>Refresh</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading files...</div>
        ) : (
          <div className="file-list">
            {path !== '/' && (
              <div className="file-row dir" onClick={() => {
                const up = path.split('/').filter(Boolean);
                up.pop();
                refresh('/' + up.join('/'));
              }}>
                <div className="file-name">..</div>
                <div className="file-meta">parent</div>
              </div>
            )}

            {dirs.map(d => (
              <div
                key={d.path}
                className="file-row dir"
                onClick={() => refresh(joinPath(path, d.name))}
              >
                <div className="file-name">{d.name}/</div>
                <div className="file-meta">dir</div>
              </div>
            ))}

            {files.map(f => (
              <div
                key={f.path}
                className="file-row"
                onClick={async () => {
                  if (f.type !== 'file') return;
                  const res = await api.readFile(spaceName, joinPath(path, f.name));
                  const bytes = Uint8Array.from(atob(res.contentBase64), c => c.charCodeAt(0));
                  const blob = new Blob([bytes]);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = f.name;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <div className="file-name">{f.name}</div>
                <div className="file-meta">
                  {f.type} · {formatBytes(f.size)}
                </div>
              </div>
            ))}

            {entries.length === 0 && (
              <div className="empty">Empty directory</div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
