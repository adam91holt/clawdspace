import { Router, Request, Response } from 'express';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as docker from '../docker';
import { SystemInfo } from '../types';

const execAsync = promisify(exec);
const router = Router();

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return bytes.toFixed(1) + ' ' + units[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

// GET /system - System stats
router.get('/', async (_req: Request, res: Response) => {
  try {
    const cpuUsage = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = os.uptime();
    
    // Docker info
    const dockerInfo = await docker.getDockerInfo();
    
    // Disk usage
    let diskUsage: SystemInfo['disk'] = null;
    try {
      const { stdout } = await execAsync("df -h / | tail -1");
      const parts = stdout.trim().split(/\s+/);
      diskUsage = {
        total: parts[1],
        used: parts[2],
        available: parts[3],
        percentage: parts[4]
      };
    } catch {
      // Ignore disk errors
    }
    
    const systemInfo: SystemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      loadAverage: cpuUsage,
      memory: {
        total: formatBytes(totalMem),
        free: formatBytes(freeMem),
        used: formatBytes(totalMem - freeMem),
        percentage: ((1 - freeMem / totalMem) * 100).toFixed(1) + '%'
      },
      disk: diskUsage,
      uptime: formatUptime(uptime),
      docker: {
        version: dockerInfo.ServerVersion || 'unknown',
        containers: dockerInfo.Containers || 0,
        containersRunning: dockerInfo.ContainersRunning || 0,
        containersPaused: dockerInfo.ContainersPaused || 0,
        images: dockerInfo.Images || 0
      }
    };
    
    res.json(systemInfo);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
