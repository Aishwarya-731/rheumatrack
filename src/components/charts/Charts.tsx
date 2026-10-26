import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LeftRightRow, RomPoint, SymptomPoint } from '@/domain/analytics';
import { fmtDateTime, fmtShortDate } from '@/domain/format';
import { movementLabel } from '@/domain/joints';
import type { AngleSample } from '@/domain/types';
import { useChartTheme } from './chartTheme';

interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  payload?: Record<string, unknown>;
}

function ChartTooltip({ active, payload, label, labelFormatter, unit }: { active?: boolean; payload?: TooltipEntry[]; label?: unknown; labelFormatter?: (l: unknown) => string; unit?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{labelFormatter ? labelFormatter(label) : String(label)}</div>
      {payload.map((p, i) => (
        <div key={i} className="row" style={{ gap: 6 }}>
          <span className="legend-swatch" style={{ background: p.color }} />
          <span>
            {p.name}: <strong className="num">{typeof p.value === 'number' ? p.value.toFixed(1) : String(p.value)}</strong>
            {unit}
          </span>
        </div>
      ))}
      {payload[0]?.payload?.synthetic === true && <div className="subtle">Synthetic sample data</div>}
    </div>
  );
}

/** Observed ROM per session over time (one point per session). */
export function RomTrendChart({ points, height = 280 }: { points: RomPoint[]; height?: number }) {
  const t = useChartTheme();
  return (
    <div className="chart-box" style={{ height }} data-testid="rom-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => fmtShortDate(v)} tick={t.tick} stroke={t.grid} />
          <YAxis tick={t.tick} stroke={t.grid} unit="°" width={52} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => fmtDateTime(Number(l))} unit="°" />} />
          <Line type="monotone" dataKey="romDeg" name="Observed ROM" stroke={t.series[0]} strokeWidth={2.5} dot={{ r: 4, fill: t.series[0], strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SymptomTrendChart({ points, height = 280 }: { points: SymptomPoint[]; height?: number }) {
  const t = useChartTheme();
  return (
    <div className="chart-box" style={{ height }} data-testid="symptom-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => fmtShortDate(v)} tick={t.tick} stroke={t.grid} />
          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={t.tick} stroke={t.grid} width={44} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => fmtDateTime(Number(l))} unit="/10" />} />
          <Legend wrapperStyle={{ color: t.muted, fontSize: 13 }} iconType="circle" />
          <Line type="monotone" dataKey="pain" name="Pain" stroke={t.series[4]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="stiffness" name="Stiffness" stroke={t.series[1]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="discomfort" name="Discomfort" stroke={t.series[2]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeftRightChart({ rows, height = 260 }: { rows: LeftRightRow[]; height?: number }) {
  const t = useChartTheme();
  const data = rows.map((r) => ({
    name: `${r.joint.charAt(0).toUpperCase() + r.joint.slice(1)} ${movementLabel(r.movement).toLowerCase()}`,
    Left: r.left.romDeg,
    Right: r.right.romDeg,
  }));
  return (
    <div className="chart-box" style={{ height }} data-testid="left-right-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -8 }} barGap={4}>
          <CartesianGrid stroke={t.grid} vertical={false} />
          <XAxis dataKey="name" tick={t.tick} stroke={t.grid} interval={0} />
          <YAxis tick={t.tick} stroke={t.grid} unit="°" width={52} />
          <Tooltip content={<ChartTooltip unit="°" />} cursor={{ fill: t.grid, opacity: 0.4 }} />
          <Legend wrapperStyle={{ color: t.muted, fontSize: 13 }} iconType="circle" />
          <Bar dataKey="Left" fill={t.series[3]} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          <Bar dataKey="Right" fill={t.series[0]} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Angle–time chart of a session's imported samples, with a cursor at the playback position. */
export function AngleTimeChart({
  samples,
  cursorMs,
  thresholds,
  height = 300,
}: {
  samples: readonly AngleSample[];
  cursorMs: number | null;
  thresholds?: { low: number; high: number } | null;
  height?: number;
}) {
  const t = useChartTheme();
  const t0 = samples[0]?.t ?? 0;
  // Down-sample for rendering only (max ~1500 points); analysis always uses every sample.
  const step = Math.max(1, Math.ceil(samples.length / 1500));
  const data: Array<{ s: number; a: number }> = [];
  for (let i = 0; i < samples.length; i += step) {
    const x = samples[i] as AngleSample;
    data.push({ s: (x.t - t0) / 1000, a: x.angleDeg });
  }
  const last = samples[samples.length - 1];
  if (last && step > 1) data.push({ s: (last.t - t0) / 1000, a: last.angleDeg });
  return (
    <div className="chart-box" style={{ height }} data-testid="angle-time-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={t.grid} />
          <XAxis dataKey="s" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => `${v.toFixed(0)}s`} tick={t.tick} stroke={t.grid} />
          <YAxis tick={t.tick} stroke={t.grid} unit="°" width={52} domain={['auto', 'auto']} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => `${Number(l).toFixed(2)} s`} unit="°" />} />
          {thresholds && <ReferenceLine y={thresholds.low} stroke={t.muted} strokeDasharray="4 4" />}
          {thresholds && <ReferenceLine y={thresholds.high} stroke={t.muted} strokeDasharray="4 4" />}
          {cursorMs !== null && <ReferenceLine x={(cursorMs - t0) / 1000} stroke={t.warning} strokeWidth={2} />}
          <Line type="linear" dataKey="a" name="Imported sample angle" stroke={t.series[0]} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
