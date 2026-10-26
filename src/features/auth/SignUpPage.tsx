import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/app/providers/AuthProvider';
import { Alert } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Fields';
import { AuthLayout } from './AuthLayout';

export const MIN_PASSWORD_LENGTH = 8;

export function validateSignUp(v: { name: string; email: string; password: string; confirm: string; consent: boolean }) {
  const errors: Partial<Record<'name' | 'email' | 'password' | 'confirm' | 'consent', string>> = {};
  if (v.name.trim().length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (v.name.trim().length > 80) errors.name = 'Name must be 80 characters or fewer.';
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) errors.email = 'Enter a valid email address.';
  if (v.password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errors.password = 'Use at least one letter and one number.';
  if (v.confirm !== v.password) errors.confirm = 'Passwords do not match.';
  if (!v.consent) errors.consent = 'Please confirm you understand how RheumaTrack is used.';
  return errors;
}

export function SignUpPage() {
  const { signUp } = useAuth();
  const [v, setV] = useState({ name: '', email: '', password: '', confirm: '', consent: false });
  const [errors, setErrors] = useState<ReturnType<typeof validateSignUp>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateSignUp(v);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      await signUp(v.email, v.password, v.name);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign-up failed.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Track symptoms and joint movement in one place.">
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        {formError && (
          <Alert kind="danger" role="alert">
            {formError}
          </Alert>
        )}
        <TextField label="Full name" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} />
        <TextField label="Email" type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, including a letter and a number."
          value={v.password}
          onChange={(e) => setV({ ...v, password: e.target.value })}
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={v.confirm}
          onChange={(e) => setV({ ...v, confirm: e.target.value })}
          error={errors.confirm}
        />
        <div className="field">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={v.consent}
              onChange={(e) => setV({ ...v, consent: e.target.checked })}
              aria-invalid={Boolean(errors.consent) || undefined}
            />
            <span style={{ fontSize: 'var(--fs-sm)' }}>
              I understand RheumaTrack records my own observations and does not diagnose any condition.
            </span>
          </label>
          {errors.consent && (
            <span className="field-error" role="alert">
              {errors.consent}
            </span>
          )}
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy && <span className="spinner" aria-hidden />}
          Create account
        </button>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
          All new accounts are personal accounts. Clinician access is granted separately by an administrator.
        </p>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
