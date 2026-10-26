import { describe, expect, it } from 'vitest';
import { ANALYSIS_CONFIG } from './analysisConfig';
import { validateMovementFile } from './validation';

const HEADER = 'timestamp,joint,side,movement,angleDeg';

function csv(rows: string[]): string {
  return [HEADER, ...rows].join('\n') + '\n';
}

function regularRows(n: number, opts: { joint?: string; side?: string; movement?: string; stepMs?: number } = {}): string[] {
  const { joint = 'shoulder', side = 'right', movement = 'flexion', stepMs = 100 } = opts;
  const base = Date.UTC(2026, 9, 26, 10, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => `${new Date(base + i * stepMs).toISOString()},${joint},${side},${movement},${20 + i}`);
}

function run(name: string, text: string) {
  return validateMovementFile(name, text, new TextEncoder().encode(text).length);
}

describe('validateMovementFile — CSV', () => {
  it('accepts a valid file and preserves every sample unchanged', () => {
    const res = run('a.csv', csv(regularRows(12)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.recording.joint).toBe('shoulder');
    expect(res.recording.side).toBe('right');
    expect(res.recording.movement).toBe('flexion');
    expect(res.recording.samples).toHaveLength(12);
    expect(res.recording.samples[0]).toEqual({ t: Date.UTC(2026, 9, 26, 10), angleDeg: 20 });
    expect(res.warnings).toHaveLength(0);
  });

  it('accepts the example from the specification (padded to the minimum sample count)', () => {
    const rows = [
      '2026-10-26T10:00:00.000Z,shoulder,right,flexion,20',
      '2026-10-26T10:00:00.100Z,shoulder,right,flexion,35',
      '2026-10-26T10:00:00.200Z,shoulder,right,flexion,55',
      ...regularRows(10).slice(3).map((r, i) => r.replace(/,\d+$/, `,${60 + i}`)),
    ];
    const res = run('spec.csv', csv(rows));
    expect(res.ok).toBe(true);
  });

  it('accepts CRLF line endings, a BOM and column reordering', () => {
    const rows = regularRows(10).map((r) => {
      const [ts, j, s, m, a] = r.split(',');
      return [a, m, s, j, ts].join(',');
    });
    const text = '﻿' + ['angleDeg,movement,side,joint,timestamp', ...rows].join('\r\n');
    const res = run('crlf.csv', text);
    expect(res.ok).toBe(true);
  });

  it('rejects an empty file', () => {
    const res = run('e.csv', '');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.message).toMatch(/empty/i);
  });

  it('rejects a header-only file', () => {
    const res = run('h.csv', HEADER + '\n');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.message).toMatch(/no data rows/i);
  });

  it('rejects missing and unexpected columns, with a radian hint', () => {
    const res = run('c.csv', 'timestamp,joint,side,movement,angleRad\n2026-10-26T10:00:00.000Z,knee,left,flexion,1\n');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const text = res.errors.map((e) => e.message).join(' ');
    expect(text).toMatch(/Missing required column\(s\): angleDeg/);
    expect(text).toMatch(/degrees/);
  });

  it('reports row-level errors for bad values without repairing them', () => {
    const rows = regularRows(12);
    rows[2] = rows[2]!.replace(/,\d+$/, ',abc');
    rows[4] = rows[4]!.replace(/^[^,]+/, 'yesterday');
    rows[6] = rows[6]!.replace(/,\d+$/, ',');
    rows[8] = rows[8]!.replace('flexion', 'twirl');
    const res = run('bad.csv', csv(rows));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const byRow = Object.fromEntries(res.errors.map((e) => [e.row, e]));
    expect(byRow[3]?.field).toBe('angleDeg');
    expect(byRow[5]?.field).toBe('timestamp');
    expect(byRow[7]?.message).toMatch(/missing/i);
    expect(byRow[9]?.message).toMatch(/Unknown movement/);
  });

  it('rejects unitful or non-finite angles and out-of-range angles', () => {
    for (const bad of ['20deg', 'NaN', 'Infinity', '181', '-200']) {
      const rows = regularRows(10);
      rows[0] = rows[0]!.replace(/,\d+$/, `,${bad}`);
      const res = run('x.csv', csv(rows));
      expect(res.ok, bad).toBe(false);
    }
  });

  it('rejects a movement that is not supported for the joint', () => {
    const res = run('m.csv', csv(regularRows(10, { joint: 'knee', movement: 'abduction' })));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.message).toMatch(/not supported for the knee/);
  });

  it('rejects mixed joints, sides or movements in one file', () => {
    const rows = regularRows(10);
    rows[5] = rows[5]!.replace(',right,', ',left,');
    const res = run('mix.csv', csv(rows));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.row).toBe(6);
    expect(res.errors[0]?.message).toMatch(/one joint, side and movement/);
  });

  it('rejects duplicate timestamps and names both rows', () => {
    const rows = regularRows(12);
    rows[4] = rows[3]!.replace(/,\d+$/, ',99');
    const res = run('dup.csv', csv(rows));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.row === 5 && /Duplicate timestamp \(same as row 4\)/.test(e.message))).toBe(true);
  });

  it('rejects out-of-order timestamps instead of sorting them', () => {
    const rows = regularRows(12);
    [rows[3], rows[4]] = [rows[4]!, rows[3]!];
    const res = run('order.csv', csv(rows));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => /ascending time order/.test(e.message))).toBe(true);
  });

  it('rejects timestamps without a timezone or with sub-millisecond precision', () => {
    const noTz = regularRows(10).map((r) => r.replace('Z,', ','));
    expect(run('tz.csv', csv(noTz)).ok).toBe(false);
    const fine = regularRows(10).map((r) => r.replace('.000Z', '.000123Z'));
    const res = run('us.csv', csv(fine));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.message).toMatch(/millisecond precision/);
  });

  it('rejects impossible calendar dates', () => {
    const rows = regularRows(10).map((r) => r.replace('2026-10-26', '2026-02-30'));
    expect(run('date.csv', csv(rows)).ok).toBe(false);
  });

  it('accepts timezone offsets and converts them to UTC', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `2026-10-26T15:30:0${i}.000+05:30,knee,left,flexion,${i * 10}`);
    const res = run('ist.csv', csv(rows));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.recording.samples[0]?.t).toBe(Date.UTC(2026, 9, 26, 10, 0, 0));
  });

  it('rejects too few samples', () => {
    const res = run('few.csv', csv(regularRows(ANALYSIS_CONFIG.minSamples - 1)));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.message).toMatch(/At least 10 samples/);
  });

  it('rejects a data gap larger than the allowed multiple of the median interval', () => {
    const base = Date.UTC(2026, 9, 26, 10);
    const times = Array.from({ length: 20 }, (_, i) => base + i * 100 + (i >= 10 ? 1000 : 0));
    const rows = times.map((t, i) => `${new Date(t).toISOString()},elbow,left,flexion,${i}`);
    const res = run('gap.csv', csv(rows));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.row).toBe(11);
    expect(res.errors[0]?.message).toMatch(/Gap/);
  });

  it('rejects files with too many irregular intervals but warns on a few', () => {
    const base = Date.UTC(2026, 9, 26, 10);
    let t = base;
    const irregularMany = Array.from({ length: 30 }, (_, i) => {
      t += i % 3 === 0 ? 160 : 100;
      return `${new Date(t).toISOString()},wrist,right,flexion,${i}`;
    });
    expect(run('irr.csv', csv(irregularMany)).ok).toBe(false);

    t = base;
    const irregularFew = Array.from({ length: 30 }, (_, i) => {
      t += i === 15 ? 140 : 100;
      return `${new Date(t).toISOString()},wrist,right,flexion,${i}`;
    });
    const ok = run('irr2.csv', csv(irregularFew));
    expect(ok.ok).toBe(true);
    expect(ok.warnings).toHaveLength(1);
  });

  it('rejects sampling rates outside 1–1000 Hz', () => {
    expect(run('slow.csv', csv(regularRows(10, { stepMs: 2000 }))).ok).toBe(false);
  });

  it('rejects files that exceed the size limit and unsupported types', () => {
    const big = validateMovementFile('big.csv', 'x', ANALYSIS_CONFIG.maxFileBytes + 1);
    expect(big.ok).toBe(false);
    const xlsx = validateMovementFile('data.xlsx', 'x', 1);
    expect(xlsx.ok).toBe(false);
    if (xlsx.ok) return;
    expect(xlsx.errors[0]?.message).toMatch(/Unsupported file type/);
  });

  it('rejects rows with the wrong number of values and interior empty rows', () => {
    const rows = regularRows(12);
    rows[1] = rows[1] + ',extra';
    rows[5] = '';
    const res = run('shape.csv', csv(rows));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.find((e) => e.row === 2)?.message).toMatch(/Expected 5 values/);
    expect(res.errors.find((e) => e.row === 6)?.message).toMatch(/Empty row/);
  });
});

describe('validateMovementFile — JSON', () => {
  const base = Date.UTC(2026, 9, 26, 10);
  const samples = Array.from({ length: 12 }, (_, i) => ({ timestamp: new Date(base + i * 20).toISOString(), angleDeg: i * 2.5 }));
  const doc = { format: 'rheumatrack.movement.v1', joint: 'ankle', side: 'left', movement: 'dorsiflexion', unit: 'deg', source: 'simulation', samples };

  it('accepts a valid document', () => {
    const res = run('a.json', JSON.stringify(doc));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.recording.format).toBe('json');
    expect(res.recording.declaredSource).toBe('simulation');
    expect(res.recording.samples[11]?.angleDeg).toBe(27.5);
  });

  it('rejects malformed JSON', () => {
    const res = run('a.json', '{"format": ');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.message).toMatch(/not valid JSON/);
  });

  it('rejects wrong format id, unit and unknown fields', () => {
    const res = run('a.json', JSON.stringify({ ...doc, format: 'x', unit: 'rad', extra: 1 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['format', 'unit']));
    expect(res.errors.some((e) => /Unexpected field/.test(e.message))).toBe(true);
  });

  it('rejects an empty samples array and non-object samples', () => {
    expect(run('a.json', JSON.stringify({ ...doc, samples: [] })).ok).toBe(false);
    const res = run('a.json', JSON.stringify({ ...doc, samples: [...samples.slice(0, 11), 5] }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]?.row).toBe(12);
  });

  it('rejects string angles that are not numbers and missing values', () => {
    const bad = samples.map((s, i) => (i === 3 ? { timestamp: s.timestamp } : s));
    const res = run('a.json', JSON.stringify({ ...doc, samples: bad }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ row: 4, field: 'angleDeg' });
  });

  it('rejects an unsupported joint/movement combination', () => {
    expect(run('a.json', JSON.stringify({ ...doc, movement: 'flexion' })).ok).toBe(false);
  });
});
