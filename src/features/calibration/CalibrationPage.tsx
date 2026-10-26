import { CheckCircle2, Crosshair, FileUp, Trash2, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSignedInUser } from '@/app/providers/AuthProvider';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { JointPicker } from '@/components/JointPicker';
import { NoSensorBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { CALIBRATION_CONFIG } from '@/domain/analysisConfig';
import { evaluateStaticHold, type StaticHoldEvaluation } from '@/domain/calibration';
import { fmtDateTime, fmtDeg } from '@/domain/format';
import { jointLabel, movementLabel } from '@/domain/joints';
import type { CalibrationRecord } from '@/domain/types';
import { validateMovementFile } from '@/domain/validation';

type Step = 'setup' | 'capture' | 'result';

interface Outcome {
  fileName: string;
  evaluation: StaticHoldEvaluation | null;
  errors: string[];
}

export function CalibrationPage() {
  const { user } = useSignedInUser();
  const { data } = useServices();
  const { calibrations } = useRecords();
  const { joint, side, movement } = useSelection();
  const { notify } = useToast();
  const [step, setStep] = useState<Step>('setup');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saved, setSaved] = useState(false);
  const [toDelete, setToDelete] = useState<CalibrationRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cancel = () => {
    setStep('setup');
    setOutcome(null);
    setSaved(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setSaved(false);
    try {
      const text = await file.text();
      const res = validateMovementFile(file.name, text, file.size);
      if (!res.ok) {
        setOutcome({ fileName: file.name, evaluation: null, errors: res.errors.slice(0, 10).map((e) => (e.row ? `Row ${e.row}: ${e.message}` : e.message)) });
      } else {
        const r = res.recording;
        const mismatch = r.joint !== joint || r.side !== side || r.movement !== movement;
        setOutcome({
          fileName: file.name,
          evaluation: mismatch ? null : evaluateStaticHold(r.samples),
          errors: mismatch ? [`The file records ${r.side} ${r.joint} ${r.movement}, but calibration was started for ${side} ${joint} ${movement}.`] : [],
        });
      }
      setStep('result');
    } catch (e) {
      setOutcome({ fileName: file.name, evaluation: null, errors: [e instanceof Error ? e.message : 'Could not read the file.'] });
      setStep('result');
    } finally {
      setBusy(false);
    }
  };

  const saveRecord = async () => {
    if (!outcome) return;
    const ev = outcome.evaluation;
    const passed = ev?.passed === true;
    setBusy(true);
    try {
      await data.createCalibration(user.uid, {
        joint,
        side,
        movement,
        inputSource: 'static-reference-file',
        sourceFileName: outcome.fileName,
        outcome: passed ? 'completed' : 'failed',
        referenceAngleDeg: passed && ev ? ev.referenceAngleDeg : null,
        holdSdDeg: ev && Number.isFinite(ev.holdSdDeg) ? ev.holdSdDeg : null,
        holdDurationMs: ev ? ev.holdDurationMs : null,
        sampleCount: ev ? ev.sampleCount : 0,
        validationMessages: ev ? ev.messages : outcome.errors,
        config: { ...CALIBRATION_CONFIG },
      });
      setSaved(true);
      notify('success', passed ? 'Static reference saved.' : 'Failed attempt recorded.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Could not save the calibration record.');
    } finally {
      setBusy(false);
    }
  };

  const passed = outcome?.evaluation?.passed === true;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calibration</h1>
          <p>Joint-specific static-reference check. It records the angle of the joint held still in a neutral position, with full metadata.</p>
        </div>
        <NoSensorBadge />
      </div>

      <Alert kind="warning" title="No sensor hardware is connected">
        Sensor calibration (orientation and offset of a worn device) needs connected hardware and is not available. You can complete a static-reference check from a recorded file instead. It
        never changes imported angles, and imported movement data is never treated as calibrated sensor data.
      </Alert>

      <div className="grid grid-main-side">
        <section className="card stack" aria-labelledby="cal-title" style={{ gap: 20 }}>
          <ol className="row" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 8 }} aria-label="Calibration steps">
            {(['setup', 'capture', 'result'] as const).map((s, i) => (
              <li key={s} className={`badge ${step === s ? 'badge-accent' : 'badge-outline'}`} aria-current={step === s ? 'step' : undefined}>
                {i + 1}. {s === 'setup' ? 'Select & read instructions' : s === 'capture' ? 'Provide static recording' : 'Validation result'}
              </li>
            ))}
          </ol>
          <h2 id="cal-title" style={{ fontSize: 'var(--fs-lg)' }}>
            {jointLabel(joint, side)} — {movementLabel(movement).toLowerCase()}
          </h2>

          {step === 'setup' && (
            <>
              <JointPicker />
              <div className="stack muted" style={{ fontSize: 'var(--fs-sm)' }}>
                <strong style={{ color: 'var(--text)' }}>Instructions</strong>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Sit or stand comfortably with the {jointLabel(joint, side).toLowerCase()} in its neutral starting position.</li>
                  <li>Record the joint angle while holding completely still for at least {CALIBRATION_CONFIG.minHoldDurationMs / 1000} seconds.</li>
                  <li>Export the recording in the RheumaTrack CSV or JSON format for this exact joint, side and movement.</li>
                </ol>
                <span>
                  The check passes when the file has at least {CALIBRATION_CONFIG.minSamples} samples, lasts at least {CALIBRATION_CONFIG.minHoldDurationMs / 1000} s and the angle’s standard deviation is at most{' '}
                  {CALIBRATION_CONFIG.maxHoldSdDeg}°. These are data-quality limits, not clinical thresholds.
                </span>
              </div>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => setStep('capture')}>
                  <Crosshair aria-hidden /> Start calibration
                </button>
              </div>
            </>
          )}

          {step === 'capture' && (
            <>
              <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="field-label" style={{ marginBottom: 8 }}>
                  Input source
                </legend>
                <label className="checkbox-row" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                  <input type="radio" name="cal-source" disabled /> Connected sensor — no sensor connected
                </label>
                <label className="checkbox-row">
                  <input type="radio" name="cal-source" defaultChecked /> Static reference recording file (.csv or .json)
                </label>
              </fieldset>
              <input ref={fileRef} type="file" accept=".csv,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="calibration-file-input" tabIndex={-1} aria-hidden />
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                  {busy ? <span className="spinner" aria-hidden /> : <FileUp aria-hidden />} Choose static recording
                </button>
                <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {step === 'result' && outcome && (
            <>
              <div className="row" role="status">
                {passed ? <CheckCircle2 aria-hidden style={{ color: 'var(--success)' }} /> : <XCircle aria-hidden style={{ color: 'var(--danger)' }} />}
                <strong>{passed ? 'Static reference check completed' : 'Static reference check not completed'}</strong>
              </div>
              <dl className="kv">
                <dt>File</dt>
                <dd>{outcome.fileName}</dd>
                {outcome.evaluation && passed && (
                  <>
                    <dt>Reference angle</dt>
                    <dd className="num">{fmtDeg(outcome.evaluation.referenceAngleDeg, 2)}</dd>
                  </>
                )}
              </dl>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--fs-sm)' }}>
                {(outcome.evaluation ? outcome.evaluation.messages : outcome.errors).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              <div className="row">
                {!saved && (outcome.evaluation !== null || outcome.errors.length > 0) && (
                  <button type="button" className="btn btn-primary" onClick={() => void saveRecord()} disabled={busy}>
                    {busy && <span className="spinner" aria-hidden />}
                    {passed ? 'Save static reference' : 'Record failed attempt'}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setStep('capture')} disabled={busy}>
                  Retry with another file
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
                  {saved ? 'Done' : 'Cancel'}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="card stack" aria-labelledby="cal-history">
          <div className="card-title" id="cal-history">
            Calibration records
          </div>
          {calibrations.length === 0 ? (
            <EmptyState icon={Crosshair} title="No calibration records" />
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 10 }}>
              {calibrations.map((c) => (
                <li key={c.id} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cell-strong" style={{ fontWeight: 600 }}>
                      {jointLabel(c.joint, c.side)} {movementLabel(c.movement).toLowerCase()}
                    </div>
                    <div className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                      {fmtDateTime(c.createdAt)} · {c.sourceFileName}
                    </div>
                    <span className={`badge ${c.outcome === 'completed' ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: 4 }}>
                      {c.outcome === 'completed' ? `Completed · ${fmtDeg(c.referenceAngleDeg, 2)}` : 'Not completed'}
                    </span>
                  </div>
                  <button type="button" className="icon-btn" aria-label={`Delete calibration record from ${fmtDateTime(c.createdAt)}`} onClick={() => setToDelete(c)}>
                    <Trash2 aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete calibration record?"
        body="Sessions that link this record keep their 'static reference linked' label but will no longer show the reference value."
        confirmLabel="Delete"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await data.deleteCalibration(user.uid, toDelete.id);
          notify('success', 'Calibration record deleted.');
        }}
      />
    </div>
  );
}
