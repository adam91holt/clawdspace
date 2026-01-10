import { useState } from 'react';
import { api } from '../api';

interface Props {
  spaceName: string;
  onClose: () => void;
  onExec: () => void;
}

export function ExecModal({ spaceName, onClose, onExec }: Props) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOutput('Running...');
    
    try {
      const result = await api.execCommand(spaceName, command);
      
      let outputText = result.stdout || result.stderr || '(no output)';
      if (result.stderr && result.stdout) {
        outputText += '\n\n[stderr]\n' + result.stderr;
      }
      outputText += `\n\n[exit code: ${result.exitCode}]`;
      
      setOutput(outputText);
      onExec();
    } catch (err) {
      setOutput(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop active" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">
          Execute Command: <span className="text-primary">{spaceName}</span>
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Command</label>
            <input
              type="text"
              className="form-input"
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="ls -la"
              required
              autoFocus
            />
          </div>
          
          {output && (
            <div className="exec-output">
              {output}
            </div>
          )}
          
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Running...' : 'Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
