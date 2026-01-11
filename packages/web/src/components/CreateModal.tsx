import { useState } from 'react';

interface Props {
  onClose: () => void;
  onCreate: (
    name: string,
    memory: string,
    cpus: number,
    repo?: { repoUrl: string; repoBranch?: string; repoDest?: string }
  ) => Promise<void>;
}

export function CreateModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [memory, setMemory] = useState('2g');
  const [cpus, setCpus] = useState(1);
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBranch, setRepoBranch] = useState('');
  const [repoDest, setRepoDest] = useState('repo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const repo = repoUrl.trim()
        ? {
            repoUrl: repoUrl.trim(),
            repoBranch: repoBranch.trim() || undefined,
            repoDest: repoDest.trim() || undefined
          }
        : undefined;

      await onCreate(name, memory, cpus, repo);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Create New Space</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-space"
              pattern="[a-zA-Z0-9_-]+"
              required
              autoFocus
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Memory</label>
              <input
                type="text"
                className="form-input"
                value={memory}
                onChange={e => setMemory(e.target.value)}
                placeholder="2g"
              />
            </div>
            <div className="form-group">
              <label className="form-label">CPUs</label>
              <input
                type="number"
                className="form-input"
                value={cpus}
                onChange={e => setCpus(parseFloat(e.target.value))}
                min="0.5"
                max="4"
                step="0.5"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">GitHub Repo (optional)</label>
            <input
              type="text"
              className="form-input"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo.git or git@github.com:org/repo.git"
            />
            <div className="form-row" style={{ marginTop: 10 }}>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <input
                  type="text"
                  className="form-input"
                  value={repoBranch}
                  onChange={e => setRepoBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dest folder</label>
                <input
                  type="text"
                  className="form-input"
                  value={repoDest}
                  onChange={e => setRepoDest(e.target.value)}
                  placeholder="repo"
                />
              </div>
            </div>
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
