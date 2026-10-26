import { describe, expect, it } from 'vitest';
import { evaluateStaticHold } from './calibration';
import { validateMovementFile } from './validation';

const files = import.meta.glob('../../matlab/samples/*.{csv,json}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('shipped sample datasets', () => {
  const entries = Object.entries(files).map(([p, text]) => [p.split('/').pop() as string, text] as const);

  it('are present', () => {
    expect(entries.filter(([n]) => n.startsWith('synthetic_')).length).toBeGreaterThanOrEqual(17);
    expect(entries.filter(([n]) => n.startsWith('invalid_')).length).toBe(4);
  });

  for (const [name, text] of entries) {
    if (name.startsWith('synthetic_')) {
      it(`${name} is accepted`, () => {
        const res = validateMovementFile(name, text, text.length);
        expect(res.ok).toBe(true);
      });
    } else if (name.startsWith('invalid_')) {
      it(`${name} is rejected with specific errors`, () => {
        const res = validateMovementFile(name, text, text.length);
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.errors.length).toBeGreaterThan(0);
      });
    }
  }

  it('the static-hold sample passes the calibration check', () => {
    const [, text] = entries.find(([n]) => n === 'synthetic_static_hold_knee_right.csv') ?? [];
    expect(text).toBeDefined();
    const res = validateMovementFile('hold.csv', text as string, (text as string).length);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(evaluateStaticHold(res.recording.samples).passed).toBe(true);
  });
});
