import { useState, useEffect, useCallback } from 'react';
import { SpacesPanel } from './components/SpacesPanel';
import { SystemStats } from './components/SystemStats';
import { NodesPanel } from './components/NodesPanel';
import { ClusterStats } from './components/ClusterStats';
import { CreateModal } from './components/CreateModal';
import { ExecModal } from './components/ExecModal';
import { Space, SystemInfo } from './types';
import { api } from './api';
import { SpaceStatsModal } from './components/SpaceStatsModal';
import { FileBrowserModal } from './components/FileBrowserModal';
import { TerminalModal } from './components/TerminalModal';
import { AuditModal } from './components/AuditModal';
import { ObservabilityModal } from './components/ObservabilityModal';

function App() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [execSpace, setExecSpace] = useState<string | null>(null);
  const [terminalSpace, setTerminalSpace] = useState<string | null>(null);
  const [statsSpace, setStatsSpace] = useState<string | null>(null);
  const [filesSpace, setFilesSpace] = useState<string | null>(null);
  const [auditSpace, setAuditSpace] = useState<string | null>(null);
  const [observabilitySpace, setObservabilitySpace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<any[] | null>(null);

  const fetchSpaces = useCallback(async () => {
    try {
      const data = await api.getSpaces();
      setSpaces(data.spaces || []);
    } catch (err) {
      console.error('Failed to fetch spaces:', err);
    }
  }, []);

  const fetchSystem = useCallback(async () => {
    try {
      const data = await api.getSystem();
      setSystem(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch system:', err);
    }
  }, []);

  useEffect(() => {
    fetchSpaces();
    fetchSystem();
    const spacesInterval = setInterval(fetchSpaces, 10000);
    const systemInterval = setInterval(fetchSystem, 30000);
    return () => {
      clearInterval(spacesInterval);
      clearInterval(systemInterval);
    };
  }, [fetchSpaces, fetchSystem]);

  const handleCreate = async (
    name: string,
    memory: string,
    cpus: number,
    repo?: { repoUrl: string; repoBranch?: string; repoDest?: string },
    envFileText?: string
  ) => {
    await api.createSpace(name, memory, cpus, false, repo, envFileText);
    setShowCreate(false);
    fetchSpaces();
  };

  const handleStop = async (name: string) => {
    await api.stopSpace(name);
    fetchSpaces();
  };

  const handleStart = async (name: string) => {
    await api.startSpace(name);
    fetchSpaces();
  };

  const handleDestroy = async (name: string) => {
    if (window.confirm(`Destroy space "${name}"? This cannot be undone.`)) {
      await api.destroySpace(name);
      fetchSpaces();
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1><span>🚀</span> Clawdspace</h1>
        <span className="updated">
          {system && `Updated: ${new Date().toLocaleTimeString()}`}
        </span>
      </header>

      <NodesPanel onNodes={setNodes} />

      <ClusterStats nodes={nodes as any} />

      <SystemStats system={system} loading={loading} spacesCount={spaces.length} />

      <SpacesPanel
        spaces={spaces}
        onCreate={() => setShowCreate(true)}
        onExec={setExecSpace}
        onTerminal={setTerminalSpace}
        onFiles={setFilesSpace}
        onStats={setStatsSpace}
        onObservability={setObservabilitySpace}
        onStop={handleStop}
        onStart={handleStart}
        onDestroy={handleDestroy}
        onPauseAll={async (names) => {
          await Promise.all(names.map((n) => api.stopSpace(n)));
          fetchSpaces();
        }}
        onAudit={(space) => setAuditSpace(space ?? '__all__')}
      />

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {execSpace && (
        <ExecModal
          spaceName={execSpace}
          onClose={() => setExecSpace(null)}
          onExec={fetchSpaces}
        />
      )}

      {terminalSpace && (
        <TerminalModal
          spaceName={terminalSpace}
          onClose={() => setTerminalSpace(null)}
        />
      )}

      {statsSpace && (
        <SpaceStatsModal
          spaceName={statsSpace}
          onClose={() => setStatsSpace(null)}
        />
      )}

      {filesSpace && (
        <FileBrowserModal
          spaceName={filesSpace}
          onClose={() => setFilesSpace(null)}
        />
      )}

      {auditSpace && (
        <AuditModal
          spaceName={auditSpace === '__all__' ? undefined : auditSpace}
          onClose={() => setAuditSpace(null)}
        />
      )}

      {observabilitySpace && (
        <ObservabilityModal
          spaceName={observabilitySpace}
          onClose={() => setObservabilitySpace(null)}
        />
      )}

      <div className="footer">
        Built by 🦞 (a tiny nod to the crustacean army) — keep it local, keep it yours.
      </div>
    </div>
  );
}

export default App;
