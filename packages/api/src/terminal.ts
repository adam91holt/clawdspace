import Docker from 'dockerode';
import type WebSocket from 'ws';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PREFIX = 'clawdspace-';
const WORKSPACE_MOUNT = '/workspace';

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number };

function safeJsonParse(input: unknown): ClientMessage | null {
  if (typeof input !== 'string') return null;
  try {
    return JSON.parse(input) as ClientMessage;
  } catch {
    return null;
  }
}

export async function startTerminalSession({
  name,
  ws
}: {
  name: string;
  ws: WebSocket;
}): Promise<void> {
  const containers = await docker.listContainers({ all: true });
  const containerInfo = containers.find(c => c.Names.includes(`/${PREFIX}${name}`));
  if (!containerInfo) {
    ws.close();
    return;
  }

  const container = docker.getContainer(containerInfo.Id);
  const info = await container.inspect();
  if (info.State.Paused) {
    await container.unpause();
  }

  const exec = await container.exec({
    Cmd: ['sh', '-l'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    WorkingDir: WORKSPACE_MOUNT,
    User: info.Config.User || 'sandbox'
  });

  const stream = await exec.start({
    hijack: true,
    stdin: true
  } as any);

  // Initial size: xterm will likely send a resize immediately.
  try {
    await exec.resize({ h: 24, w: 80 } as any);
  } catch {
    // ignore
  }

  const onMessage = (data: WebSocket.RawData) => {
    try {
      // Binary: treat as raw keystrokes for backward compatibility.
      if (Buffer.isBuffer(data)) {
        stream.write(data);
        return;
      }

      const msg = safeJsonParse(data);
      if (msg?.type === 'resize') {
        const cols = Math.max(1, Math.min(500, Math.floor(msg.cols)));
        const rows = Math.max(1, Math.min(200, Math.floor(msg.rows)));
        exec.resize({ w: cols, h: rows } as any).catch(() => {});
        return;
      }

      if (msg?.type === 'input') {
        stream.write(Buffer.from(msg.data));
        return;
      }

      if (typeof data === 'string') {
        stream.write(Buffer.from(data));
        return;
      }

      stream.write(Buffer.from(data as any));
    } catch {
      // ignore
    }
  };

  ws.on('message', onMessage);

  stream.on('data', (chunk: Buffer) => {
    try {
      ws.send(chunk);
    } catch {
      // ignore
    }
  });

  const cleanup = () => {
    try {
      ws.off('message', onMessage);
    } catch {
      // ignore
    }
    try {
      stream.end();
    } catch {
      // ignore
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
  stream.on('end', () => {
    try {
      ws.close();
    } catch {
      // ignore
    }
  });
  stream.on('error', () => {
    try {
      ws.close();
    } catch {
      // ignore
    }
  });
}
