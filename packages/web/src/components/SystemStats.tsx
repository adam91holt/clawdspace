import { SystemInfo } from '../types';

interface Props {
  system: SystemInfo | null;
  loading: boolean;
  spacesCount: number;
}

export function SystemStats({ system, loading, spacesCount }: Props) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">CPU Load</div>
        <div className={`stat-value ${loading ? 'loading' : ''}`}>
          {system ? system.loadAverage[0].toFixed(2) : '--'}
        </div>
        <div className="stat-sub">{system ? `${system.cpus} cores` : '-- cores'}</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-label">Memory</div>
        <div className={`stat-value ${loading ? 'loading' : ''}`}>
          {system?.memory.percentage || '--%'}
        </div>
        <div className="stat-sub">
          {system ? `${system.memory.used} / ${system.memory.total}` : '-- / --'}
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-label">Disk</div>
        <div className={`stat-value ${loading ? 'loading' : ''}`}>
          {system?.disk?.percentage || '--%'}
        </div>
        <div className="stat-sub">
          {system?.disk ? `${system.disk.used} / ${system.disk.total}` : '-- / --'}
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-label">Spaces</div>
        <div className="stat-value">{spacesCount}</div>
        <div className="stat-sub">
          {system ? `${system.docker.containersRunning} running` : '0 running'}
        </div>
      </div>
    </div>
  );
}
