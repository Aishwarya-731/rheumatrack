import { CalendarPlus, Database, Moon, Save, Sun, Trash2, UserCog } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth, useSignedInUser } from '@/app/providers/AuthProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { SyntheticBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert } from '@/components/ui/Feedback';
import { Segmented, SelectField, TextField } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { downloadText } from '@/app/download';
import { buildReminderIcs, describeSchedule, nextOccurrence, validateReminderSettings, WEEKDAY_LABELS } from '@/domain/reminders';
import type { ReminderSettings } from '@/domain/types';
import { addSyntheticSampleData } from './syntheticSeed';

function timeZoneOptions(current: string): Array<{ value: string; label: string }> {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  if (!zones.includes('UTC')) zones.push('UTC');
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}

const fullFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SettingsPage() {
  const { user, profile, role } = useSignedInUser();
  const { refreshUser, signOut } = useAuth();
  const { auth, data, mode } = useServices();
  const { theme, setTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(profile.displayName);
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);
  const [rem, setRem] = useState<ReminderSettings>(profile.reminders);
  const [remError, setRemError] = useState<string | null>(null);
  const [savingRem, setSavingRem] = useState(false);
  const [confirmSynthetic, setConfirmSynthetic] = useState(false);
  const [addingSynthetic, setAddingSynthetic] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (v.length < 2 || v.length > 80) return setNameError('Enter 2–80 characters.');
    setNameError(undefined);
    setSavingName(true);
    try {
      await data.updateProfile(user.uid, { displayName: v });
      await auth.updateDisplayName(v);
      notify('success', 'Name updated.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Could not update your name.');
    } finally {
      setSavingName(false);
    }
  };

  const saveReminders = async () => {
    const err = validateReminderSettings(rem);
    setRemError(err);
    if (err) return;
    setSavingRem(true);
    try {
      await data.updateProfile(user.uid, { reminders: { ...rem, days: [...rem.days].sort((a, b) => a - b) } });
      notify('success', rem.enabled ? `Reminders saved: ${describeSchedule(rem)}.` : 'Reminders turned off.');
    } catch (e) {
      notify('error', e instanceof Error ? e.message : 'Could not save reminders.');
    } finally {
      setSavingRem(false);
    }
  };

  const toggleDay = (d: number) => setRem((r) => ({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d] }));
  const next = rem.enabled && !validateReminderSettings(rem) ? nextOccurrence(rem, Date.now()) : null;
  const remChanged = JSON.stringify({ ...rem, days: [...rem.days].sort() }) !== JSON.stringify({ ...profile.reminders, days: [...profile.reminders.days].sort() });

  const deleteAccount = async () => {
    setDeleteError(null);
    if (deleteText !== 'DELETE') return setDeleteError('Type DELETE to confirm.');
    if (!deletePassword) return setDeleteError('Enter your password.');
    setDeleting(true);
    try {
      await auth.reauthenticate(deletePassword);
      await data.deleteAllUserData(user.uid);
      await auth.deleteAccount(deletePassword);
      navigate('/login', { replace: true });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Account deletion failed.');
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Profile, appearance, reminders and your data.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="profile-title">
          <div className="row">
            <UserCog aria-hidden style={{ color: 'var(--accent)' }} />
            <div className="card-title" id="profile-title">
              Profile
            </div>
          </div>
          <form className="stack" onSubmit={(e) => void saveName(e)} noValidate>
            <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} autoComplete="name" />
            <dl className="kv">
              <dt>Email</dt>
              <dd>
                {user.email} {user.emailVerified ? <span className="badge badge-success">Verified</span> : <span className="badge badge-outline">Not verified</span>}
              </dd>
              <dt>Account type</dt>
              <dd>{role === 'clinician' ? 'Clinician' : 'Personal account'}</dd>
            </dl>
            <div className="row">
              <button type="submit" className="btn btn-primary" disabled={savingName || name.trim() === profile.displayName}>
                {savingName ? <span className="spinner" aria-hidden /> : <Save aria-hidden />} Save name
              </button>
              {!user.emailVerified && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    auth.sendEmailVerification().then(
                      () => notify('success', mode === 'emulator' ? 'Verification link written to the emulator log.' : 'Verification email sent.'),
                      (e: unknown) => notify('error', e instanceof Error ? e.message : 'Could not send the email.'),
                    )
                  }
                >
                  Verify email
                </button>
              )}
              {!user.emailVerified && (
                <button type="button" className="btn btn-ghost" onClick={() => void refreshUser()}>
                  Refresh status
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card stack" aria-labelledby="appearance-title">
          <div className="row">
            {theme === 'dark' ? <Moon aria-hidden style={{ color: 'var(--accent)' }} /> : <Sun aria-hidden style={{ color: 'var(--accent)' }} />}
            <div className="card-title" id="appearance-title">
              Appearance
            </div>
          </div>
          <div className="field">
            <span className="field-label">Theme</span>
            <Segmented<'dark' | 'light'> label="Theme" value={theme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} onChange={setTheme} />
            <span className="field-hint">Saved on this device. The header button switches it from any page.</span>
          </div>
        </section>
      </div>

      {role !== 'clinician' && (
        <section className="card stack" aria-labelledby="reminder-title">
          <div className="row row-between">
            <div className="row">
              <CalendarPlus aria-hidden style={{ color: 'var(--accent)' }} />
              <div className="card-title" id="reminder-title">
                Check-in reminders
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={rem.enabled} onChange={(e) => setRem({ ...rem, enabled: e.target.checked })} />
              <span>Enabled</span>
            </label>
          </div>
          <Alert kind="info" title="How reminders are delivered">
            While RheumaTrack is open, a banner appears when a check-in time has passed. RheumaTrack does not send push notifications or emails. For reminders when the app is closed, add the
            schedule to your calendar app with the calendar file below.
          </Alert>
          <div className="form-grid">
            <TextField label="Time" type="time" value={rem.time} onChange={(e) => setRem({ ...rem, time: e.target.value })} disabled={!rem.enabled} />
            <SelectField<string> label="Timezone" value={rem.timezone} options={timeZoneOptions(rem.timezone)} onChange={(timezone) => setRem({ ...rem, timezone })} disabled={!rem.enabled} />
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={!rem.enabled}>
            <legend className="field-label" style={{ marginBottom: 8 }}>
              Days
            </legend>
            <div className="row" style={{ gap: 8 }}>
              {WEEKDAY_LABELS.map((label, i) => (
                <button key={label} type="button" className={`btn btn-sm ${rem.days.includes(i + 1) ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={rem.days.includes(i + 1)} onClick={() => toggleDay(i + 1)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {remError && (
            <p className="field-error" role="alert">
              {remError}
            </p>
          )}
          {next !== null && <p className="muted">Next check-in: {fullFmt.format(next)} (your device’s local time)</p>}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => void saveReminders()} disabled={savingRem || !remChanged}>
              {savingRem ? <span className="spinner" aria-hidden /> : <Save aria-hidden />} Save reminders
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={rem.days.length === 0 || validateReminderSettings(rem) !== null}
              onClick={() => {
                downloadText('rheumatrack-checkin-reminder.ics', buildReminderIcs(rem, Date.now(), window.location.origin), 'text/calendar');
                notify('info', 'Calendar file downloaded. Open it to add the reminder to your calendar.');
              }}
            >
              <CalendarPlus aria-hidden /> Download calendar file (.ics)
            </button>
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="data-title">
        <div className="row">
          <Database aria-hidden style={{ color: 'var(--accent)' }} />
          <div className="card-title" id="data-title">
            Your data
          </div>
        </div>
        {role !== 'clinician' && (
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Export everything from <Link to="/reports">Reports &amp; export</Link>.
          </p>
        )}
        {role !== 'clinician' && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row">
              <SyntheticBadge />
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Synthetic records are simulation-generated sessions and generated sample check-ins.
              </span>
            </div>
            <div className="row">
              {mode === 'emulator' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={addingSynthetic}
                  onClick={async () => {
                    setAddingSynthetic(true);
                    try {
                      const r = await addSyntheticSampleData(data, user.uid);
                      notify('success', `Added ${r.sessions} synthetic sessions and ${r.assessments} synthetic check-ins.`);
                    } catch (e) {
                      notify('error', e instanceof Error ? e.message : 'Could not add sample data.');
                    } finally {
                      setAddingSynthetic(false);
                    }
                  }}
                >
                  {addingSynthetic && <span className="spinner" aria-hidden />} Add synthetic sample data (local development)
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmSynthetic(true)}>
                <Trash2 aria-hidden /> Remove all synthetic data
              </button>
            </div>
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="row row-between">
            <div>
              <div style={{ fontWeight: 600 }}>Delete account and all data</div>
              <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Permanently deletes your sessions, samples, check-ins, calibration records, sharing and your sign-in account.
              </div>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden /> Delete account
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmSynthetic}
        title="Remove all synthetic data?"
        body="Deletes every movement session marked as simulation-generated and every synthetic check-in. Your own imported recordings and check-ins are kept."
        confirmLabel="Remove synthetic data"
        danger
        onClose={() => setConfirmSynthetic(false)}
        onConfirm={async () => {
          const r = await data.deleteSyntheticData(user.uid);
          notify('success', `Removed ${r.sessions} synthetic sessions and ${r.assessments} synthetic check-ins.`);
        }}
      />

      <Modal
        open={deleteOpen}
        title="Delete account permanently?"
        onClose={() => !deleting && setDeleteOpen(false)}
        locked={deleting}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)} disabled={deleting} data-autofocus>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void deleteAccount()} disabled={deleting}>
              {deleting && <span className="spinner" aria-hidden />} Delete everything
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            This cannot be undone. Consider exporting your data first.
          </p>
          <TextField label="Password" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          <TextField label="Type DELETE to confirm" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
          {deleteError && (
            <p className="field-error" role="alert">
              {deleteError}
            </p>
          )}
        </div>
      </Modal>
      <div className="no-print">
        <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
