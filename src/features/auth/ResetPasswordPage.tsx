import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useServices } from '@/app/providers/ServicesProvider';
import { Alert } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Fields';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const { auth, mode } = useServices();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await auth.sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We will email you a link to choose a new password.">
      {sent ? (
        <Alert kind="success" title="Check your email" role="status">
          If an account exists for {email.trim()}, a password reset link has been sent.
          {mode === 'emulator' && ' In the local emulator, the link appears in the emulator terminal output and the Emulator UI instead of an inbox.'}
        </Alert>
      ) : (
        <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
          {formError && (
            <Alert kind="danger" role="alert">
              {formError}
            </Alert>
          )}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <span className="spinner" aria-hidden />}
            Send reset link
          </button>
        </form>
      )}
      <p className="muted">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
