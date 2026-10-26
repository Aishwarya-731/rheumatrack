import { CheckCircle2, FileWarning, UploadCloud } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSignedInUser } from '@/app/providers/AuthProvider';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { AngleTimeChart } from '@/components/charts/Charts';
import { NoSensorBadge } from '@/components/ui/Badges';
import { Alert } from '@/components/ui/Feedback';
import { SelectField, TextAreaField } from '@/components/ui/Fields';
import { ANALYSIS_CONFIG } from '@/domain/analysisConfig';
import { fmtDeg, fmtDuration, fmtNumber } from '@/domain/format';
import { jointLabel, movementLabel } from '@/domain/joints';
import { computeMetrics } from '@/domain/metrics';
import { countRepetitions } from '@/domain/repetitions';
import type { DataSource } from '@/domain/types';
import { formatBytes, validateMovementFile, type ValidationResult } from '@/domain/validation';

type Phase = { kind: 'idle' } | { kind: 'reading'; name: string } | { kind: 'result'; name: string; size: number; result: ValidationResult };

async function readFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('Could not read the file.'));
    r.readAsText(file);
  });
}

export function ImportPage() {
  const { user } = useSignedInUser();
  const { data } = useServices();
  const { calibrations } = useRecords();
  const { select } = useSelection();
  const { notify } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [source, setSource] = useState<DataSource | ''>('');
  const [calibrationId, setCalibrationId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setSaveError(null);
    setCalibrationId('');
    setPhase({ kind: 'reading', name: file.name });
    if (file.size > ANALYSIS_CONFIG.maxFileBytes) {
      setPhase({ kind: 'result', name: file.name, size: file.size, result: validateMovementFile(file.name, '', file.size) });
      return;
    }
    try {
      const text = await readFile(file);
      const result = validateMovementFile(file.name, text, file.size);
      setPhase({ kind: 'result', name: file.name, size: file.size, result });
      if (result.ok) {
        setSource(result.recording.declaredSource === 'simulation' ? 'simulation' : '');
        select(result.recording.joint, result.recording.side, result.recording.movement);
      }
    } catch (e) {
      setPhase({
        kind: 'result',
        name: file.name,
        size: file.size,
        result: { ok: false, errors: [{ row: null, field: null, message: e instanceof Error ? e.message : 'Could not read the file.' }], totalErrors: 1, warnings: [] },
      });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  const ok = phase.kind === 'result' && phase.result.ok ? phase.result : null;
  const metrics = useMemo(() => (ok ? computeMetrics(ok.recording.samples) : null), [ok]);
  const reps = useMemo(() => (ok ? countRepetitions(ok.recording.samples.map((s) => s.angleDeg)) : null), [ok]);
  const matchingCalibrations = ok
    ? calibrations.filter((c) => c.outcome === 'completed' && c.joint === ok.recording.joint && c.side === ok.recording.side && c.movement === ok.recording.movement)
    : [];

  const reset = () => {
    setPhase({ kind: 'idle' });
    setSource('');
    setNotes('');
    setSaveError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const save = async () => {
    if (!ok || !metrics || phase.kind !== 'result') return;
    if (source !== 'imported' && source !== 'simulation') {
      setSaveError('Select where this recording came from.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const id = await data.createSession(
        user.uid,
        {
          joint: ok.recording.joint,
          side: ok.recording.side,
          movement: ok.recording.movement,
          source,
          isSynthetic: source === 'simulation',
          sourceFileName: phase.name,
          sourceFormat: ok.recording.format,
          metrics,
          calibrationId: calibrationId || null,
          calibrationStatus: calibrationId ? 'reference-available' : 'not-calibrated',
          notes: notes.trim(),
        },
        ok.recording.samples,
      );
      notify('success', 'Movement session saved.');
      navigate(`/sessions/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the session.');
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Import movement data</h1>
          <p>Upload a timestamped joint-angle recording (CSV or JSON) from MATLAB or another acquisition tool. Invalid files are rejected with row-level messages and are never altered.</p>
        </div>
        <NoSensorBadge />
      </div>

      {phase.kind !== 'result' && (
        <div className="grid grid-main-side">
          <section className="card">
            <div
              className={`dropzone${dragging ? ' dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              aria-label="Choose a CSV or JSON movement file"
            >
              {phase.kind === 'reading' ? (
                <span className="row">
                  <span className="spinner" aria-hidden /> Validating {phase.name}…
                </span>
              ) : (
                <>
                  <UploadCloud aria-hidden />
                  <strong style={{ color: 'var(--text)' }}>Drop a file here or click to choose</strong>
                  <span style={{ fontSize: 'var(--fs-sm)' }}>
                    .csv or .json · up to {formatBytes(ANALYSIS_CONFIG.maxFileBytes)} · {ANALYSIS_CONFIG.minSamples.toLocaleString('en')}–{ANALYSIS_CONFIG.maxSamples.toLocaleString('en')} samples
                  </span>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              data-testid="movement-file-input"
              onChange={(e) => void handleFile(e.target.files?.[0])}
              tabIndex={-1}
              aria-hidden
            />
          </section>
          <aside className="card stack" style={{ fontSize: 'var(--fs-sm)' }}>
            <div className="card-title">Expected CSV format</div>
            <pre style={{ margin: 0, padding: 12, borderRadius: 10, background: 'var(--surface-2)', overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {`timestamp,joint,side,movement,angleDeg
2026-10-26T10:00:00.000Z,shoulder,right,flexion,20
2026-10-26T10:00:00.100Z,shoulder,right,flexion,35
2026-10-26T10:00:00.200Z,shoulder,right,flexion,55`}
            </pre>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              <li>One joint, side and movement per file; angles in degrees.</li>
              <li>ISO 8601 timestamps with a timezone, ascending, no duplicates, at most millisecond precision.</li>
              <li>Consistent sampling between 1 and 1000 Hz with no gaps longer than 5× the median interval.</li>
            </ul>
            <p className="subtle">The JSON format and full rules are in the project documentation (DATA_CONTRACT.md).</p>
          </aside>
        </div>
      )}

      {phase.kind === 'result' && !phase.result.ok && (
        <section className="card stack" aria-labelledby="rejected-title">
          <div className="row">
            <FileWarning aria-hidden style={{ color: 'var(--danger)' }} />
            <h2 id="rejected-title" style={{ fontSize: 'var(--fs-lg)' }}>
              File rejected — {phase.name}
            </h2>
          </div>
          <Alert kind="danger" role="alert" title={`${phase.result.totalErrors} problem${phase.result.totalErrors === 1 ? '' : 's'} found`}>
            Nothing was saved. Fix the file at the source and upload it again; RheumaTrack does not repair or reorder measurements.
          </Alert>
          <div className="table-wrap">
            <table className="table" data-testid="validation-errors">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Problem</th>
                </tr>
              </thead>
              <tbody>
                {phase.result.errors.map((e, i) => (
                  <tr key={i}>
                    <td className="num">{e.row ?? 'File'}</td>
                    <td>{e.field ?? '—'}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {phase.result.totalErrors > phase.result.errors.length && (
            <p className="subtle">Showing the first {phase.result.errors.length} of {phase.result.totalErrors} problems.</p>
          )}
          <div>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Choose another file
            </button>
          </div>
        </section>
      )}

      {ok && metrics && reps && phase.kind === 'result' && (
        <>
          <Alert kind="success" title={`Valid file — ${phase.name}`} role="status">
            {ok.recording.samples.length.toLocaleString('en')} samples of {jointLabel(ok.recording.joint, ok.recording.side).toLowerCase()} {movementLabel(ok.recording.movement).toLowerCase()} ({formatBytes(phase.size)}). Review the
            observed values, confirm the source and save.
          </Alert>
          {ok.warnings.map((w, i) => (
            <Alert key={i} kind="warning" title="Data quality note">
              {w.message}
            </Alert>
          ))}
          <div className="grid grid-main-side">
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Imported sample angles</div>
                  <div className="card-subtitle">Every sample as recorded; dashed lines show the repetition-counting thresholds</div>
                </div>
              </div>
              <AngleTimeChart samples={ok.recording.samples} cursorMs={null} thresholds={reps.lowThresholdDeg !== null && reps.highThresholdDeg !== null ? { low: reps.lowThresholdDeg, high: reps.highThresholdDeg } : null} />
            </section>
            <section className="card stack">
              <div className="card-title">Calculated from the samples</div>
              <dl className="kv" data-testid="import-metrics">
                <dt>Observed ROM</dt>
                <dd className="num" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>
                  {fmtDeg(metrics.romDeg)}
                </dd>
                <dt>Minimum angle</dt>
                <dd className="num">{fmtDeg(metrics.minDeg)}</dd>
                <dt>Maximum angle</dt>
                <dd className="num">{fmtDeg(metrics.maxDeg)}</dd>
                <dt>Mean angle</dt>
                <dd className="num">{fmtDeg(metrics.meanDeg)}</dd>
                <dt>Duration</dt>
                <dd className="num">{fmtDuration(metrics.durationMs)}</dd>
                <dt>Sampling</dt>
                <dd className="num">
                  {fmtNumber(metrics.interval.rateHz, 1)} Hz (median interval {fmtNumber(metrics.interval.median, 1)} ms)
                </dd>
                <dt>Repetitions</dt>
                <dd className="num">{metrics.repetitions ?? <span className="subtle">{metrics.repetitionNote}</span>}</dd>
              </dl>
              <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                Observed ROM = maximum − minimum angle in this recording. It is not a clinically validated range-of-motion assessment.
              </p>
            </section>
          </div>

          <section className="card stack" aria-labelledby="confirm-title">
            <div className="card-title" id="confirm-title">
              Confirm and save
            </div>
            <div className="form-grid">
              <SelectField<DataSource | ''>
                label="Where did this recording come from?"
                value={source}
                onChange={setSource}
                options={[
                  { value: '', label: 'Select a source', disabled: true },
                  { value: 'simulation', label: 'Simulation-generated (e.g. MATLAB synthetic data)' },
                  { value: 'imported', label: 'External recording of a real movement' },
                  { value: 'hardware', label: 'Connected sensor — no sensor connected', disabled: true },
                ]}
                hint={source === 'simulation' ? 'Simulation-generated sessions are labelled as synthetic sample data everywhere.' : 'This label is shown with every value from this session.'}
                error={saveError && !source ? saveError : undefined}
                data-testid="source-select"
              />
              <SelectField<string>
                label="Static reference (optional)"
                value={calibrationId}
                onChange={setCalibrationId}
                options={[
                  { value: '', label: 'None — not calibrated' },
                  ...matchingCalibrations.map((c) => ({ value: c.id, label: `Reference ${fmtDeg(c.referenceAngleDeg)} · ${new Date(c.createdAt).toLocaleDateString('en-GB')}` })),
                ]}
                hint={
                  matchingCalibrations.length === 0 ? (
                    <>
                      No completed static reference for this joint and movement. <Link to="/calibration">Run calibration</Link>
                    </>
                  ) : (
                    'Links a static-reference record as metadata. Angles are not modified.'
                  )
                }
              />
            </div>
            <TextAreaField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} style={{ minHeight: 80 }} />
            {saveError && source && (
              <Alert kind="danger" role="alert">
                {saveError}
              </Alert>
            )}
            <div className="row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => void save()} disabled={saving}>
                {saving ? <span className="spinner" aria-hidden /> : <CheckCircle2 aria-hidden />}
                Save session
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={reset} disabled={saving}>
                Discard
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
