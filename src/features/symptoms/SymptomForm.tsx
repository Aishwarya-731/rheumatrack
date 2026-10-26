import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Feedback';
import { Segmented, SelectField, TextAreaField, TextField } from '@/components/ui/Fields';
import { JOINT_CATALOGUE, JOINTS, SIDES, sideLabel, type Joint, type Side } from '@/domain/joints';
import { MAX_NOTES_LENGTH, SCALE_MAX, SCALE_MIN, validateSymptomForm, type SymptomFormErrors, type SymptomFormValues, type ValidSymptomInput } from '@/domain/symptoms';

const SCORE_FIELDS = [
  { key: 'pain', label: 'Pain', hint: 'How much pain you feel in this joint right now.' },
  { key: 'stiffness', label: 'Stiffness', hint: 'How stiff or hard to move the joint feels.' },
  { key: 'discomfort', label: 'Discomfort', hint: 'General discomfort such as aching or tenderness.' },
] as const;

function ScoreSlider({ label, hint, value, onChange, error }: { label: string; hint: string; value: number; onChange: (v: number) => void; error?: string | undefined }) {
  const id = useId();
  const pct = ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  return (
    <div className="slider-field">
      <div className="slider-head">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="slider-value" aria-hidden>
          {value}
          <small>/10</small>
        </span>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={SCALE_MIN}
        max={SCALE_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
        aria-valuetext={`${value} out of 10`}
        aria-describedby={`${id}-hint`}
        aria-invalid={Boolean(error) || undefined}
      />
      <div className="slider-anchors" aria-hidden>
        <span>0 · None</span>
        <span>5</span>
        <span>10 · Worst imaginable</span>
      </div>
      <span id={`${id}-hint`} className="field-hint">
        {hint}
      </span>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface SymptomFormProps {
  initial: SymptomFormValues;
  submitLabel: string;
  onSubmit: (value: ValidSymptomInput) => Promise<void>;
  onCancel?: () => void;
  onJointChange?: (joint: Joint, side: Side) => void;
}

export function SymptomForm({ initial, submitLabel, onSubmit, onCancel, onJointChange }: SymptomFormProps) {
  const [values, setValues] = useState<SymptomFormValues>(initial);
  const [errors, setErrors] = useState<SymptomFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof SymptomFormValues>(k: K, v: SymptomFormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if ((k === 'joint' || k === 'side') && next.joint && next.side) onJointChange?.(next.joint, next.side);
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = validateSymptomForm(values);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(res.value);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the assessment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={(e) => void submit(e)} noValidate aria-label="Symptom assessment" style={{ gap: 24 }}>
      {formError && (
        <Alert kind="danger" role="alert">
          {formError}
        </Alert>
      )}
      <div className="form-grid">
        <SelectField<Joint | ''>
          label="Joint"
          value={values.joint}
          options={[{ value: '', label: 'Select a joint', disabled: true }, ...JOINTS.map((j) => ({ value: j, label: JOINT_CATALOGUE[j].label }))]}
          onChange={(v) => set('joint', v)}
          error={errors.joint}
        />
        <div className="field">
          <span className="field-label">Side</span>
          <Segmented<Side> label="Side" value={(values.side || 'right') as Side} options={SIDES.map((s) => ({ value: s, label: sideLabel(s) }))} onChange={(v) => set('side', v)} />
          {errors.side && (
            <span className="field-error" role="alert">
              {errors.side}
            </span>
          )}
        </div>
      </div>
      <div style={{ maxWidth: 340 }}>
        <TextField
          label="Date and time of assessment"
          type="datetime-local"
          value={values.assessedAtLocal}
          onChange={(e) => set('assessedAtLocal', e.target.value)}
          error={errors.assessedAtLocal}
        />
      </div>

      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 22 }}>
        <legend className="card-title" style={{ marginBottom: 12 }}>
          Symptoms (0 = none, 10 = worst imaginable)
        </legend>
        {SCORE_FIELDS.map((f) => (
          <ScoreSlider key={f.key} label={f.label} hint={f.hint} value={values[f.key]} onChange={(v) => set(f.key, v)} error={errors[f.key]} />
        ))}
      </fieldset>

      <TextField
        label="Duration of stiffness or discomfort (minutes)"
        inputMode="numeric"
        placeholder="e.g. 30 — leave empty if not applicable"
        hint="How long the stiffness or discomfort lasted, in whole minutes (maximum 1440)."
        value={values.durationMinutes}
        onChange={(e) => set('durationMinutes', e.target.value)}
        error={errors.durationMinutes}
      />
      <TextAreaField
        label="Notes (optional)"
        placeholder="Anything unusual today — activity, sleep, weather, medication timing…"
        hint={`${values.notes.length}/${MAX_NOTES_LENGTH} characters`}
        maxLength={MAX_NOTES_LENGTH + 100}
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
        error={errors.notes}
      />
      <div className="row">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ flex: '1 1 220px' }}>
          {busy && <span className="spinner" aria-hidden />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary btn-lg" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
