import { useEffect, useState } from 'react';
import { api } from '../api';

type AuditEvent = {
  ts: string;
  space?: string;
  type: string;
  meta?: Record<string, unknown>;
};

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function AuditModal({
  spaceName,
  onClose
}: {
  spaceName?: string;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchEvents() {
      setLoading(true);
      try {
        const res = await api.getAudit(spaceName);
        if (!mounted) return;
        setEvents(res.events || []);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchEvents();
    const t = setInterval(fetchEvents, 5000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [spaceName]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Audit Log {spaceName ? `· ${spaceName}` : ''}</h3>
          <button className="btn btn-icon" onClick={onClose}>×</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <div className="audit-list">
            {events.map((e, idx) => (
              <div key={idx} className="audit-row">
                <div className="audit-ts">{formatTs(e.ts)}</div>
                <div className="audit-type">{e.type}</div>
                <div className="audit-meta">
                  {e.meta ? JSON.stringify(e.meta) : ''}
                </div>
              </div>
            ))}
            {events.length === 0 && <div className="empty">No events yet</div>}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
