export type EnvFileWriteRequest = {
  envFileBase64?: string;
  envFileText?: string;
  envFilePath?: string;
};

export function validateEnvFileWriteRequest(req?: EnvFileWriteRequest): { path: string; content: string } | null {
  if (!req) return null;

  const path = (req.envFilePath || '/workspace/.env').trim() || '/workspace/.env';
  if (!path.startsWith('/workspace/')) {
    throw new Error('envFilePath must be under /workspace');
  }

  const hasB64 = typeof req.envFileBase64 === 'string' && req.envFileBase64.trim().length > 0;
  const hasText = typeof req.envFileText === 'string' && req.envFileText.trim().length > 0;

  if (!hasB64 && !hasText) return null;
  if (hasB64 && hasText) throw new Error('Provide only one of envFileBase64 or envFileText');

  if (hasB64) {
    let decoded = '';
    try {
      decoded = Buffer.from(req.envFileBase64!.trim(), 'base64').toString('utf8');
    } catch {
      throw new Error('Invalid envFileBase64');
    }
    if (!decoded.trim()) throw new Error('Decoded env file is empty');
    return { path, content: decoded };
  }

  return { path, content: req.envFileText! };
}
