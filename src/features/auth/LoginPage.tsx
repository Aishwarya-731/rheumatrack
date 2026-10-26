import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/app/providers/AuthProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { Alert } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Fields';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { signIn } = useAuth();
  const { mode } = useServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Sign in to continue tracking.">
      {mode === 'emulator' && (
        <Alert kind="info" title="Local development environment">
          Connected to the Firebase Emulator Suite on this computer. Run <code>npm run seed</code> to create the labelled synthetic sample accounts
          described in the README.
        </Alert>
      )}
      <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
        {formError && (
          <Alert kind="danger" role="alert">
            {formError}
          </Alert>
        )}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <div className="row row-between">
          <Link to="/reset-password">Forgot password?</Link>
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy && <span className="spinner" aria-hidden />}
          Sign in
        </button>
      </form>
      <p className="muted">
        New to RheumaTrack? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
