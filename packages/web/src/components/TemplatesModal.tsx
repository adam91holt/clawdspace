import { useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { z } from 'zod';
import { ModalShell } from './ModalShell';
import { api } from '../api';

const TemplateName = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9._-]*$/i);

type TemplateListItem = { name: string; description?: string };

function validateYaml(input: string): { ok: boolean; error?: string; name?: string } {
  try {
    const doc: any = yaml.load(input);
    const name = TemplateName.safeParse(doc?.name);
    if (!name.success) return { ok: false, error: 'Invalid name (name is required)' };

    // Very light validation in UI; server enforces full schema.
    return { ok: true, name: String(doc.name) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const DEFAULT_YAML = `name: default
description: Internet access, block LAN + metadata by policy
resources:
  memory: 2g
  cpus: 1
  gpu: false
security:
  writableRootfs: true
network:
  mode: internet
  blockCidrs:
    - 10.0.0.0/8
    - 172.16.0.0/12
    - 192.168.0.0/16
    - 100.64.0.0/10
    - 169.254.0.0/16
workspace:
  defaultRepoDest: repo
`;

export function TemplatesModal({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [yamlText, setYamlText] = useState(DEFAULT_YAML);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validation = useMemo(() => validateYaml(yamlText), [yamlText]);

  async function refresh() {
    const res = await api.getTemplates();
    setTemplates(res.templates || []);
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  async function loadTemplate(name: string) {
    setLoading(true);
    try {
      const res = await api.getTemplate(name);
      setSelected(name);
      setYamlText(res.yaml);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    try {
      await api.upsertTemplate(yamlText);
      await refresh();
      const next = validateYaml(yamlText);
      if (next.ok && next.name) setSelected(next.name);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setLoading(true);
    try {
      await api.deleteTemplate(selected);
      setSelected(null);
      setYamlText(DEFAULT_YAML);
      await refresh();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      title="Templates"
      subtitle="YAML profiles for space creation"
      onClose={onClose}
      wide
      right={
        <button className="btn btn-sm" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      }
    >
      <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-title">Saved</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {templates.map((t) => (
              <button
                key={t.name}
                className={`btn btn-sm ${selected === t.name ? 'btn-primary' : ''}`}
                onClick={() => loadTemplate(t.name)}
                disabled={loading}
                style={{ justifyContent: 'space-between' }}
              >
                <span>{t.name}</span>
                <span className="text-muted text-sm">{t.description || ''}</span>
              </button>
            ))}
            {!templates.length ? <div className="empty-state">No templates yet.</div> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Editor</div>
          <textarea
            className="form-input"
            style={{ marginTop: 10, height: 360, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
          />

          {error ? <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div> : null}

          {!validation.ok ? (
            <div className="alert alert-warning" style={{ marginTop: 10 }}>
              YAML invalid: {validation.error}
            </div>
          ) : (
            <div className="alert" style={{ marginTop: 10 }}>
              Valid YAML. Name: <code>{validation.name}</code>
            </div>
          )}

          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => { setSelected(null); setYamlText(DEFAULT_YAML); }} disabled={loading}>
                New
              </button>
              <button className="btn btn-danger" onClick={remove} disabled={loading || !selected}>
                Delete
              </button>
            </div>
            <button className="btn btn-primary" onClick={save} disabled={loading || !validation.ok}>
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
