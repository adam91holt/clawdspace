import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getApiKey } from '../api';

type TerminalStatus = 'connecting' | 'connected' | 'closed' | 'error';

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

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
  const [status, setStatus] = useState<TerminalStatus>('connecting');

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

    setStatus('connecting');

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    const send = (msg: ClientMessage) => {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // ignore
      }
    };

    ws.onopen = () => {
      setStatus('connected');

      // Initial size
      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;
        send({ type: 'resize', cols, rows });
      } catch {
        // ignore
      }

      term.writeln(`Connected to ${spaceName}`);
    };

    ws.onclose = () => {
      setStatus('closed');
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onmessage = (evt) => {
      const t = termRef.current;
      if (!t) return;
      if (typeof evt.data === 'string') {
        t.write(evt.data);
      } else {
        const bytes = new Uint8Array(evt.data as ArrayBuffer);
        t.write(new TextDecoder().decode(bytes));
      }
    };

    const disposer = term.onData((data) => {
      send({ type: 'input', data });
    });

    const onResize = () => {
      try {
        fit.fit();
        send({ type: 'resize', cols: term.cols, rows: term.rows });
      } catch {
        // ignore
      }
    };

    // Resize from window changes
    window.addEventListener('resize', onResize);

    // Resize when xterm's geometry changes
    const resizeDisposer = term.onResize(() => onResize());

    return () => {
      window.removeEventListener('resize', onResize);
      try {
        resizeDisposer.dispose();
      } catch {
        // ignore
      }
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
