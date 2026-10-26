import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  hideLabel?: boolean;
}

function FieldShell({ label, hint, error, children, hideLabel }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { label: string; hint?: ReactNode; error?: string | undefined; hideLabel?: boolean };

export function TextField({ label, hint, error, hideLabel, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel}>
      {({ id, describedBy, invalid }) => (
        <input id={id} className={`input ${className ?? ''}`} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...rest} />
      )}
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & { label: string; hint?: ReactNode; error?: string | undefined };

export function TextAreaField({ label, hint, error, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => <textarea id={id} className="textarea" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...rest} />}
    </FieldShell>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

type SelectFieldProps<T extends string> = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'onChange' | 'value'> & {
  label: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
  hint?: ReactNode;
  error?: string | undefined;
  hideLabel?: boolean;
};

export function SelectField<T extends string>({ label, value, options, onChange, hint, error, hideLabel, ...rest }: SelectFieldProps<T>) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          className="select"
          value={value}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value as T)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
