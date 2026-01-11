import { describe, it, expect } from 'vitest';
import { templateDefaults } from '../src/templates/effective';

describe('templateDefaults', () => {
  it('maps network.mode none -> docker none', () => {
    const eff = templateDefaults({ name: 'offline', network: { mode: 'none' } } as any);
    expect(eff.networkMode).toBe('none');
  });

  it('maps network.mode internet -> bridge', () => {
    const eff = templateDefaults({ name: 'default', network: { mode: 'internet' } } as any);
    expect(eff.networkMode).toBe('bridge');
  });
});
