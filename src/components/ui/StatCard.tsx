import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Sparkline({ values, color, label }: { values: readonly number[]; color: string; label: string }) {
  const w = 72;
  const h = 32;
  const bars = values.slice(-14);
  if (bars.length === 0) return null;
  const max = Math.max(1, ...bars);
  const bw = w / bars.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {bars.map((v, i) => {
        const bh = v === 0 ? 2 : Math.max(3, (v / max) * h);
        return <rect key={i} x={i * bw + 1} y={h - bh} width={Math.max(2, bw - 2)} height={bh} rx={1.5} fill={color} opacity={v === 0 ? 0.25 : 0.85} />;
      })}
    </svg>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  color?: string;
  spark?: { values: number[]; label: string };
}

export function StatCard({ icon: Icon, label, value, foot, color = 'var(--accent)', spark }: StatCardProps) {
  return (
    <section className="stat-card" style={{ ['--stat-color' as string]: color }} aria-label={label}>
      <div className="stat-icon">
        <Icon aria-hidden />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-row">
        <div className="stat-value">{value}</div>
        {spark && <Sparkline values={spark.values} color={color} label={spark.label} />}
      </div>
      <div className="stat-foot">{foot}</div>
    </section>
  );
}
