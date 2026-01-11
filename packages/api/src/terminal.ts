import Docker from 'dockerode';
import type WebSocket from 'ws';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PREFIX = 'clawdspace-';
const WORKSPACE_MOUNT = '/workspace';

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
    Cmd: ['sh'],
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

  const onMessage = (data: WebSocket.RawData) => {
    try {
      if (Buffer.isBuffer(data)) {
        stream.write(data);
      } else if (typeof data === 'string') {
        stream.write(Buffer.from(data));
      } else {
        stream.write(Buffer.from(data as any));
      }
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
