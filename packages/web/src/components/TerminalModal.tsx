import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getApiKey } from '../api';

export function TerminalModal({
  spaceName,
  onClose
}: {
  spaceName: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>('connecting');

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const key = encodeURIComponent(getApiKey());
    return `${proto}//${window.location.host}/api/spaces/${encodeURIComponent(spaceName)}/terminal?key=${key}`;
  }, [spaceName]);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: 'rgba(18, 22, 40, 0.95)'
      }
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    termRef.current = term;
    fitRef.current = fit;

    const el = containerRef.current;
    if (el) {
      term.open(el);
      fit.fit();
    }

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      term.writeln(`Connected to ${spaceName}`);
      term.write('$ ');
    };

    ws.onclose = () => {
      setStatus('closed');
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onmessage = (evt) => {
      if (!termRef.current) return;
      if (typeof evt.data === 'string') {
        termRef.current.write(evt.data);
      } else {
        const bytes = new Uint8Array(evt.data as ArrayBuffer);
        termRef.current.write(new TextDecoder().decode(bytes));
      }
    };

    const disposer = term.onData((data) => {
      try {
        ws.send(data);
      } catch {
        // ignore
      }
    });

    const onResize = () => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      try {
        disposer.dispose();
      } catch {
        // ignore
      }
      try {
        ws.close();
      } catch {
        // ignore
      }
      try {
        term.dispose();
      } catch {
        // ignore
      }
    };
  }, [spaceName, wsUrl]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Terminal: {spaceName} <span className="muted">({status})</span></h3>
          <button className="btn btn-icon" onClick={onClose}>×</button>
        </div>

        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <div ref={containerRef} style={{ height: 420, width: '100%' }} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => {
            try { wsRef.current?.close(); } catch {}
            onClose();
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}
