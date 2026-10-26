import { Share2, ShieldCheck, UserX } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSignedInUser } from '@/app/providers/AuthProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, ErrorCard } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Fields';
import { fmtDateTime } from '@/domain/format';
import type { ShareGrant, ShareInvite } from '@/domain/types';

export function SharingPage() {
  const { user, profile } = useSignedInUser();
  const { data } = useServices();
  const { notify } = useToast();
  const [invites, setInvites] = useState<ShareInvite[] | null>(null);
  const [shares, setShares] = useState<ShareGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<ShareInvite | null>(null);

  useEffect(() => {
    const onError = (e: Error) => setError(e.message);
    const u1 = data.subscribeInvitesByPatient(user.uid, setInvites, onError);
    const u2 = data.subscribeSharesByPatient(user.uid, setShares, onError);
    return () => {
      u1();
      u2();
    };
  }, [data, user.uid]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(value)) return setEmailError('Enter the clinician’s email address.');
    if (value === user.email.toLowerCase()) return setEmailError('You cannot share with your own account.');
    if (invites?.some((i) => i.clinicianEmail === value && i.status !== 'revoked')) return setEmailError('You have already invited this clinician.');
    if (!consent) return setEmailError('Confirm that you consent to sharing your records.');
    setEmailError(undefined);
    setBusy(true);
    try {
      await data.createInvite(user.uid, profile.displayName || user.email, value);
      notify('success', `Invitation created for ${value}.`);
      setEmail('');
      setConsent(false);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Could not create the invitation.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  const active = (invites ?? []).filter((i) => i.status !== 'revoked').sort((a, b) => b.createdAt - a.createdAt);
  const revoked = (invites ?? []).filter((i) => i.status === 'revoked');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sharing</h1>
          <p>Give a clinician read-only access to your records. Access needs your invitation and their acceptance, and you can revoke it at any time.</p>
        </div>
      </div>
      <div className="grid grid-main-side">
        <section className="card stack">
          <div className="card-title">Invite a clinician</div>
          <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
            <TextField
              label="Clinician’s email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              hint="They must have a RheumaTrack clinician account with this verified email."
            />
            <label className="checkbox-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span style={{ fontSize: 'var(--fs-sm)' }}>
                I consent to this clinician viewing all my movement sessions, symptom check-ins and calibration records (read-only) until I revoke access.
              </span>
            </label>
            <div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <span className="spinner" aria-hidden /> : <Share2 aria-hidden />} Send invitation
              </button>
            </div>
          </form>
          <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            RheumaTrack does not send emails. Tell your clinician you have invited them; the invitation appears when they sign in.
          </p>
        </section>
        <aside className="card stack">
          <div className="row">
            <ShieldCheck aria-hidden style={{ color: 'var(--accent)' }} />
            <div className="card-title">How access works</div>
          </div>
          <ul className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0, paddingLeft: 18 }}>
            <li>Nothing is ever public. There are no share links.</li>
            <li>Only the invited email, on a verified clinician account, can accept.</li>
            <li>Clinicians can view but never change or delete your records.</li>
            <li>Revoking removes access immediately, enforced by the database security rules.</li>
          </ul>
        </aside>
      </div>

      <section className="card stack" aria-labelledby="invites-title">
        <div className="card-title" id="invites-title">
          Invitations and access
        </div>
        {invites === null || shares === null ? (
          <div className="skeleton" style={{ height: 80 }} />
        ) : active.length === 0 ? (
          <EmptyState icon={Share2} title="Not shared with anyone">
            Your records are visible only to you.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Clinician</th>
                  <th>Status</th>
                  <th>Invited</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((i) => {
                  const share = shares.find((s) => s.inviteId === i.id);
                  return (
                    <tr key={i.id}>
                      <td className="cell-strong">{i.clinicianEmail}</td>
                      <td>
                        {share ? (
                          <span className="badge badge-success">Access active since {fmtDateTime(share.createdAt)}</span>
                        ) : i.status === 'accepted' ? (
                          <span className="badge badge-outline">Removed by clinician</span>
                        ) : (
                          <span className="badge badge-warning">Waiting for clinician</span>
                        )}
                      </td>
                      <td>{fmtDateTime(i.createdAt)}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setRevoking(i)}>
                          <UserX aria-hidden /> {share ? 'Revoke access' : 'Cancel invitation'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {revoked.length > 0 && <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{revoked.length} earlier invitation(s) revoked.</p>}
      </section>

      <Alert kind="info">Exports you download are files on your device. If you send them to anyone, they are outside RheumaTrack’s access controls.</Alert>

      <ConfirmDialog
        open={revoking !== null}
        title="Revoke access?"
        body={revoking ? `${revoking.clinicianEmail} will immediately lose access to your records. You can invite them again later.` : ''}
        confirmLabel="Revoke"
        danger
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await data.revokeInvite(revoking, shares ?? []);
          notify('success', 'Access revoked.');
        }}
      />
    </div>
  );
}
