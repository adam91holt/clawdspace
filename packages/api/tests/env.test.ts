import { describe, it, expect } from 'vitest';
import { validateEnvFileWriteRequest } from '../src/envfile';

describe('envfile validation', () => {
  it('returns null when empty', () => {
    expect(validateEnvFileWriteRequest({})).toBeNull();
  });

  it('rejects non-workspace path', () => {
    expect(() => validateEnvFileWriteRequest({ envFileText: 'A=1', envFilePath: '/etc/passwd' })).toThrow(/workspace/);
  });

  it('accepts envFileText', () => {
    const res = validateEnvFileWriteRequest({ envFileText: 'A=1' });
    expect(res?.path).toBe('/workspace/.env');
    expect(res?.content).toContain('A=1');
  });

  it('accepts envFileBase64', () => {
    const b64 = Buffer.from('A=1\nB=2', 'utf8').toString('base64');
    const res = validateEnvFileWriteRequest({ envFileBase64: b64, envFilePath: '/workspace/custom.env' });
    expect(res?.path).toBe('/workspace/custom.env');
    expect(res?.content).toContain('B=2');
  });
});
