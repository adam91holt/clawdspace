import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getApiKey, setApiKey } from '../api';
import { ModalShell } from './ModalShell';

type TerminalStatus = 'connecting' | 'connected' | 'closed' | 'error' | 'needs_key';

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' };

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
  const pingTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<TerminalStatus>('connecting');

  const apiKey = useMemo(() => getApiKey(), []);

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const key = encodeURIComponent(getApiKey());
    return `${proto}//${window.location.host}/api/spaces/${encodeURIComponent(spaceName)}/terminal?key=${key}`;
  }, [spaceName]);

  useEffect(() => {
    // Ensure API key exists (websocket auth uses query param)
    if (!getApiKey()) {
      setStatus('needs_key');
      const key = window.prompt('Enter API Key (required for terminal):');
      if (key) {
        setApiKey(key);
        return;
      }
    }

    let disposed = false;

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

    const send = (ws: WebSocket, msg: ClientMessage) => {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // ignore
      }
    };

    const connect = () => {
      if (disposed) return;

      setStatus('connecting');

      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        setStatus('connected');

        // Initial size
        try {
          const cols = term.cols || 80;
          const rows = term.rows || 24;
          send(ws, { type: 'resize', cols, rows });
        } catch {
          // ignore
        }

        term.writeln(`Connected to ${spaceName}`);
      };

      ws.onclose = () => {
        if (disposed) return;
        setStatus('closed');
      };

      ws.onerror = () => {
        if (disposed) return;
        setStatus('error');
      };

      ws.onmessage = (evt) => {
        const t = termRef.current;
        if (!t) return;

        if (typeof evt.data === 'string') {
          // ignore pong
          try {
            const obj = JSON.parse(evt.data);
            if (obj?.type === 'pong') return;
          } catch {
            // not json
          }
          t.write(evt.data);
          return;
        }

        const bytes = new Uint8Array(evt.data as ArrayBuffer);
        t.write(new TextDecoder().decode(bytes));
      };

      // Keepalive ping to avoid idle disconnects
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          send(ws, { type: 'ping' });
        }
      }, 15000);
    };

    connect();

    const disposer = term.onData((data) => {
      const w = wsRef.current;
      if (!w || w.readyState !== WebSocket.OPEN) return;
      send(w, { type: 'input', data });
    });

    const onResize = () => {
      const w = wsRef.current;
      if (!w || w.readyState !== WebSocket.OPEN) return;
      try {
        fit.fit();
        send(w, { type: 'resize', cols: term.cols, rows: term.rows });
      } catch {
        // ignore
      }
    };

    window.addEventListener('resize', onResize);
    const resizeDisposer = term.onResize(() => onResize());

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      try { resizeDisposer.dispose(); } catch {}
      try { disposer.dispose(); } catch {}
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      try { wsRef.current?.close(); } catch {}
      try { term.dispose(); } catch {}
    };
  }, [spaceName, wsUrl, apiKey]);

  const reconnect = () => {
    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
    // Create a new websocket by remounting the modal content.
    // Easiest: trigger a soft refresh of this component by updating location hash.
    window.location.hash = `terminal-${spaceName}-${Date.now()}`;
    window.location.reload();
  };

  return (
    <ModalShell
      title="Terminal"
      subtitle={`${spaceName} · /workspace`}
      wide
      onClose={onClose}
      right={(status === 'closed' || status === 'error') ? (<button className="btn" onClick={reconnect}>Reconnect</button>) : null}
    >

        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <div ref={containerRef} style={{ height: 420, width: '100%' }} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => {
            try { wsRef.current?.close(); } catch {}
            onClose();
          }}>Close</button>
        </div>
    </ModalShell>
  );
}
