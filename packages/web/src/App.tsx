import { useState, useEffect, useCallback } from 'react';
import { SpaceList } from './components/SpaceList';
import { SystemStats } from './components/SystemStats';
import { CreateModal } from './components/CreateModal';
import { ExecModal } from './components/ExecModal';
import { Space, SystemInfo } from './types';
import { api } from './api';
import { SpaceStatsModal } from './components/SpaceStatsModal';
import { FileBrowserModal } from './components/FileBrowserModal';
import { TerminalModal } from './components/TerminalModal';

function App() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [execSpace, setExecSpace] = useState<string | null>(null);
  const [terminalSpace, setTerminalSpace] = useState<string | null>(null);
  const [statsSpace, setStatsSpace] = useState<string | null>(null);
  const [filesSpace, setFilesSpace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleCreate = async (name: string, memory: string, cpus: number) => {
    await api.createSpace(name, memory, cpus);
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
      <header>
        <h1><span>🚀</span> Clawdspace</h1>
        <span className="updated">
          {system && `Updated: ${new Date().toLocaleTimeString()}`}
        </span>
      </header>

      <SystemStats system={system} loading={loading} spacesCount={spaces.length} />

      <section className="section">
        <div className="section-header">
          <h2>Spaces</h2>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Space
          </button>
        </div>

        <SpaceList
          spaces={spaces}
          onExec={setExecSpace}
          onTerminal={setTerminalSpace}
          onFiles={setFilesSpace}
          onStats={setStatsSpace}
          onStop={handleStop}
          onStart={handleStart}
          onDestroy={handleDestroy}
        />
      </section>

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
    </div>
  );
}

export default App;
