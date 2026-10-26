import { Cpu, FileInput, FlaskConical, Sparkles } from 'lucide-react';
import { DATA_SOURCE_LABEL, type DataSource } from '@/domain/types';

/** Always-visible provenance label for any movement value. */
export function SourceBadge({ source, synthetic }: { source: DataSource; synthetic?: boolean }) {
  const Icon = source === 'simulation' ? FlaskConical : source === 'hardware' ? Cpu : FileInput;
  const kind = source === 'simulation' ? 'badge-violet' : source === 'hardware' ? 'badge-success' : 'badge-info';
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`badge ${kind}`}>
        <Icon aria-hidden />
        {DATA_SOURCE_LABEL[source]}
      </span>
      {synthetic && <SyntheticBadge />}
    </span>
  );
}

export function SyntheticBadge() {
  return (
    <span className="badge badge-warning" title="Synthetic sample data — not a measurement of any person">
      <Sparkles aria-hidden />
      Synthetic sample data
    </span>
  );
}

export function NoSensorBadge() {
  return (
    <span className="badge badge-outline">
      <span className="status-dot" aria-hidden style={{ color: 'var(--text-subtle)' }} />
      No sensor connected
    </span>
  );
}
