import { Gauge, Upload } from 'lucide-react';
import { Link } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { SourceBadge } from '@/components/ui/Badges';
import { EmptyState } from '@/components/ui/Feedback';
import { RomRing, ROM_RING_SCALE_DEG } from '@/components/ui/RomRing';
import { latestPerMovement } from '@/domain/analytics';
import { fmtDate } from '@/domain/format';
import { jointLabel, movementsFor } from '@/domain/joints';

const RING_COLORS = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-2)'];

/** One ring per movement of the selected joint, from the latest imported session of each. */
export function RomRingsPanel() {
  const { sessions, readOnly, basePath } = useRecords();
  const { joint, side, movement, setMovement } = useSelection();
  const latest = latestPerMovement(sessions, joint, side);
  const any = latest.size > 0;

  return (
    <section className="card stack" aria-labelledby="rings-title">
      <div className="card-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="card-title" id="rings-title">
            Observed ROM — {jointLabel(joint, side)}
          </div>
          <div className="card-subtitle">Latest imported session per movement · ring scale 0–{ROM_RING_SCALE_DEG}°</div>
        </div>
      </div>
      {!any ? (
        <EmptyState
          icon={Gauge}
          title={`No movement data yet for ${jointLabel(joint, side).toLowerCase()}`}
          action={
            !readOnly && (
              <Link to="/movement/import" className="btn btn-primary btn-sm">
                <Upload aria-hidden /> Import data
              </Link>
            )
          }
        >
          The 3D figure still shows an illustrative animation. No numbers are shown until a recording is imported.
        </EmptyState>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {movementsFor(joint).map((m, i) => {
            const s = latest.get(m.id) ?? null;
            const active = m.id === movement;
            return (
              <div
                key={m.id}
                className="stack"
                style={{
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 14,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                  gap: 8,
                }}
              >
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMovement(m.id)} aria-pressed={active} style={{ fontWeight: 650, color: 'var(--text)' }}>
                  {m.label}
                </button>
                <RomRing romDeg={s ? s.metrics.romDeg : null} caption={s ? 'observed' : 'no data'} color={RING_COLORS[i % RING_COLORS.length]} size={124} />
                {s ? (
                  <>
                    <Link to={`${basePath}/sessions/${s.id}`} className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                      {fmtDate(s.startedAt)}
                    </Link>
                    <SourceBadge source={s.source} synthetic={s.isSynthetic} />
                  </>
                ) : (
                  <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                    Not recorded
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
        Observed ROM = max − min angle in one recording. The ring shows the value on a 0–180° scale; it is not a rating and not a clinical reference.
      </p>
    </section>
  );
}
