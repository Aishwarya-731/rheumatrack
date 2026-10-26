import { Activity, Calculator, Download, FileText, Pause, Play, RotateCcw, SkipBack, SkipForward, Trash2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { AngleTimeChart } from '@/components/charts/Charts';
import { SourceBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { TextAreaField } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { ANALYSIS_CONFIG } from '@/domain/analysisConfig';
import { samplesToCsv, samplesToJson } from '@/domain/export';
import { downloadText } from '@/app/download';
import { fmtDateTime, fmtDeg, fmtDuration, fmtNumber } from '@/domain/format';
import { jointLabel, movementLabel } from '@/domain/joints';
import { countRepetitions } from '@/domain/repetitions';
import type { AngleSample, MovementSession } from '@/domain/types';
import { usePlayback } from './usePlayback';

const SamplePlayer3D = lazy(() => import('@/features/viewer3d/SamplePlayer3D'));

export function SessionDetailPage() {
  const { id } = useParams();
  const { sessions, calibrations, loading, error, readOnly, ownerUid, basePath } = useRecords();
  const session = sessions.find((s) => s.id === id);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  if (loading) return <div className="page"><LoadingCard lines={8} /></div>;
  if (!session) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState icon={Activity} title="Session not found" action={<Link to={`${basePath}/history`} className="btn btn-secondary">Go to history</Link>}>
            This movement session does not exist or has been deleted.
          </EmptyState>
        </div>
      </div>
    );
  }
  const calibration = session.calibrationId ? calibrations.find((c) => c.id === session.calibrationId) ?? null : null;
  return <SessionDetail key={session.id} session={session} ownerUid={ownerUid} readOnly={readOnly} basePath={basePath} calibrationRef={calibration?.referenceAngleDeg ?? null} />;
}

function SessionDetail({ session, ownerUid, readOnly, basePath, calibrationRef }: { session: MovementSession; ownerUid: string; readOnly: boolean; basePath: string; calibrationRef: number | null }) {
  const { data } = useServices();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [samples, setSamples] = useState<AngleSample[] | null>(null);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [howOpen, setHowOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notes, setNotes] = useState(session.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const pb = usePlayback(samples);
  const m = session.metrics;

  useEffect(() => {
    let cancelled = false;
    setSamplesError(null);
    data
      .getSessionSamples(ownerUid, session)
      .then((s) => !cancelled && setSamples(s))
      .catch((e: unknown) => !cancelled && setSamplesError(e instanceof Error ? e.message : 'Could not load samples.'));
    return () => {
      cancelled = true;
    };
  }, [data, ownerUid, session, attempt]);

  const reps = useMemo(() => (samples ? countRepetitions(samples.map((s) => s.angleDeg)) : null), [samples]);
  const name = `${jointLabel(session.joint, session.side)} ${movementLabel(session.movement).toLowerCase()}`;
  const fileBase = `rheumatrack_${session.joint}_${session.side}_${session.movement}_${session.id}`;

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await data.updateSessionNotes(ownerUid, session.id, notes.trim());
      notify('success', 'Notes saved.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{name}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <SourceBadge source={session.source} synthetic={session.isSynthetic} />
            <span className={`badge ${session.calibrationStatus === 'reference-available' ? 'badge-accent' : 'badge-outline'}`}>
              {session.calibrationStatus === 'reference-available' ? 'Static reference linked' : 'Not calibrated'}
            </span>
          </div>
        </div>
        <div className="page-actions">
          <Link to={`${basePath}/reports/session/${session.id}`} className="btn btn-secondary">
            <FileText aria-hidden /> Session report
          </Link>
          {!readOnly && (
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="player-title">
          <div className="card-header">
            <div>
              <div className="card-title" id="player-title">
                Imported sample playback
              </div>
              <div className="card-subtitle">The figure is posed by the recorded angle of each sample — not an illustrative animation</div>
            </div>
          </div>
          {samplesError ? (
            <Alert kind="danger" title="Samples could not be loaded" role="alert">
              {samplesError}{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((a) => a + 1)}>
                Retry
              </button>
            </Alert>
          ) : !samples ? (
            <div className="skeleton" style={{ height: 320 }} aria-label="Loading samples" />
          ) : (
            <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
              <SamplePlayer3D joint={session.joint} side={session.side} movement={session.movement} angleDeg={pb.current?.angleDeg ?? null} height={320} />
            </Suspense>
          )}
        </section>
        <section className="card" aria-labelledby="chart-title">
          <div className="card-header">
            <div>
              <div className="card-title" id="chart-title">
                Angle over time
              </div>
              <div className="card-subtitle">Imported samples; the vertical line marks the playback position</div>
            </div>
          </div>
          {samples ? <AngleTimeChart samples={samples} cursorMs={pb.current?.t ?? null} thresholds={reps && reps.lowThresholdDeg !== null && reps.highThresholdDeg !== null ? { low: reps.lowThresholdDeg, high: reps.highThresholdDeg } : null} /> : <div className="skeleton" style={{ height: 300 }} />}
        </section>
      </div>

      {samples && samples.length > 1 && (
        <section className="card" aria-label="Playback controls">
          <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
            <button type="button" className="icon-btn" onClick={() => pb.seek(pb.index - Math.max(1, Math.round(samples.length / 50)))} aria-label="Step back">
              <SkipBack aria-hidden />
            </button>
            {pb.playing ? (
              <button type="button" className="btn btn-primary" onClick={pb.pause} aria-label="Pause playback" style={{ borderRadius: 999, width: 56, height: 56 }}>
                <Pause aria-hidden />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={pb.play} aria-label="Play recording" style={{ borderRadius: 999, width: 56, height: 56 }}>
                <Play aria-hidden />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={() => pb.seek(pb.index + Math.max(1, Math.round(samples.length / 50)))} aria-label="Step forward">
              <SkipForward aria-hidden />
            </button>
            <button type="button" className="icon-btn" onClick={pb.replay} aria-label="Replay from start">
              <RotateCcw aria-hidden />
            </button>
          </div>
          <input
            type="range"
            className="range"
            min={0}
            max={samples.length - 1}
            value={pb.index}
            onChange={(e) => pb.seek(Number(e.target.value))}
            aria-label="Playback position"
            aria-valuetext={`Sample ${pb.index + 1} of ${samples.length}`}
            style={{ ['--pct' as string]: `${(pb.index / (samples.length - 1)) * 100}%` }}
          />
          <div className="row row-between subtle num" style={{ fontSize: 'var(--fs-sm)' }}>
            <span>
              Sample {pb.index + 1} / {samples.length} · {fmtDuration((pb.current?.t ?? samples[0]!.t) - samples[0]!.t)}
            </span>
            <span>
              Imported sample angle: <strong style={{ color: 'var(--text)' }}>{fmtDeg(pb.current?.angleDeg ?? null)}</strong>
            </span>
          </div>
        </section>
      )}

      <div className="card">
        <dl className="kv">
          <dt>Recorded</dt>
          <dd>{fmtDateTime(session.startedAt)}</dd>
          <dt>Imported</dt>
          <dd>{fmtDateTime(session.createdAt)}</dd>
          <dt>Source file</dt>
          <dd>{session.sourceFileName ?? '—'}</dd>
          <dt>Calibration</dt>
          <dd>
            {session.calibrationStatus === 'reference-available'
              ? `Static reference ${calibrationRef !== null ? fmtDeg(calibrationRef) : '(record deleted)'} linked as metadata; angles unchanged`
              : 'Not calibrated'}
          </dd>
        </dl>
      </div>

      <div className="grid grid-3">
        <section className="card stack">
          <div className="card-title">Repetitions</div>
          <div className="stat-value">{m.repetitions ?? '—'}</div>
          <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            {m.repetitions === null ? m.repetitionNote : 'Completed low → high → low cycles (hysteresis method).'}
          </p>
        </section>
        <section className="card stack">
          <div className="card-title">{jointLabel(session.joint, session.side)}</div>
          <dl className="kv" data-testid="session-metrics">
            <dt>Max angle</dt>
            <dd className="num">{fmtDeg(m.maxDeg)}</dd>
            <dt>Min angle</dt>
            <dd className="num">{fmtDeg(m.minDeg)}</dd>
            <dt>Observed ROM</dt>
            <dd className="num" style={{ fontWeight: 700 }}>
              {fmtDeg(m.romDeg)}
            </dd>
            <dt>Mean angle</dt>
            <dd className="num">{fmtDeg(m.meanDeg)}</dd>
          </dl>
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setHowOpen(true)}>
            <Calculator aria-hidden /> How is this calculated?
          </button>
        </section>
        <section className="card stack">
          <div className="card-title">Recording quality</div>
          <dl className="kv">
            <dt>Samples</dt>
            <dd className="num">{m.sampleCount.toLocaleString('en')}</dd>
            <dt>Duration</dt>
            <dd className="num">{fmtDuration(m.durationMs)}</dd>
            <dt>Sampling rate</dt>
            <dd className="num">{fmtNumber(m.interval.rateHz, 1)} Hz</dd>
            <dt>Interval (min–max)</dt>
            <dd className="num">
              {fmtNumber(m.interval.min, 1)}–{fmtNumber(m.interval.max, 1)} ms
            </dd>
            <dt>Irregular intervals</dt>
            <dd className="num">
              {m.quality.irregularIntervals} ({fmtNumber(m.quality.irregularIntervalPct, 1)}%)
            </dd>
          </dl>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card stack">
          <div className="card-title">Notes</div>
          {readOnly ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{session.notes || <span className="subtle">No notes.</span>}</p>
          ) : (
            <>
              <TextAreaField label="Session notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} style={{ minHeight: 90 }} />
              <div>
                <button type="button" className="btn btn-secondary" onClick={() => void saveNotes()} disabled={savingNotes || notes.trim() === session.notes}>
                  {savingNotes && <span className="spinner" aria-hidden />} Save notes
                </button>
              </div>
            </>
          )}
        </section>
        <section className="card stack">
          <div className="card-title">Export samples</div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Downloads every recorded sample in the RheumaTrack import format, so the file can be re-imported or analysed in MATLAB.
          </p>
          <div className="row">
            <button type="button" className="btn btn-secondary" disabled={!samples} onClick={() => samples && downloadText(`${fileBase}.csv`, samplesToCsv(session, samples), 'text/csv')}>
              <Download aria-hidden /> CSV
            </button>
            <button type="button" className="btn btn-secondary" disabled={!samples} onClick={() => samples && downloadText(`${fileBase}.json`, samplesToJson(session, samples), 'application/json')}>
              <Download aria-hidden /> JSON
            </button>
          </div>
        </section>
      </div>

      <Modal open={howOpen} title="How these values are calculated" onClose={() => setHowOpen(false)} footer={<button type="button" className="btn btn-primary" onClick={() => setHowOpen(false)}>Close</button>}>
        <div className="stack muted" style={{ fontSize: 'var(--fs-sm)' }}>
          <p>All values are calculated from the {m.sampleCount.toLocaleString('en')} recorded samples of this session. The same calculation in MATLAB or Python gives the same result.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><strong>Observed ROM</strong> = maximum angle − minimum angle ({fmtDeg(m.maxDeg, 2)} − {fmtDeg(m.minDeg, 2)} = {fmtDeg(m.romDeg, 2)}). It is not simply the maximum angle.</li>
            <li><strong>Mean angle</strong> = the arithmetic mean of all sample angles.</li>
            <li><strong>Repetitions</strong> are counted when the angle goes from below {ANALYSIS_CONFIG.repLowFraction * 100}% of the observed range to above {ANALYSIS_CONFIG.repHighFraction * 100}% and back below. Counting is skipped if the observed range is under {ANALYSIS_CONFIG.repMinRomDeg}°.</li>
            <li><strong>Irregular intervals</strong> differ from the median sampling interval by more than {ANALYSIS_CONFIG.irregularTolerance * 100}%.</li>
          </ul>
          <p>Observed ROM describes this recording only. It has not been validated against a clinical reference measurement and is not a diagnosis.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this movement session?"
        body="This permanently removes the session and all of its samples. Other sessions and check-ins are not affected."
        confirmLabel="Delete session"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await data.deleteSession(ownerUid, session);
          notify('success', 'Session deleted.');
          navigate(`${basePath}/history`, { replace: true });
        }}
      />
    </div>
  );
}
