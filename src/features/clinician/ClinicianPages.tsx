import { ArrowLeft, Inbox, MailCheck, UserMinus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useAuth, useSignedInUser } from '@/app/providers/AuthProvider';
import { RecordsProvider, useRecords } from '@/app/providers/RecordsProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { fmtDateTime } from '@/domain/format';
import type { ShareGrant, ShareInvite } from '@/domain/types';

export function ClinicianHomePage() {
  const { user } = useSignedInUser();
  const { refreshUser } = useAuth();
  const { data, auth } = useServices();
  const { notify } = useToast();
  const [invites, setInvites] = useState<ShareInvite[] | null>(null);
  const [shares, setShares] = useState<ShareGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ShareGrant | null>(null);

  useEffect(() => {
    const onError = (e: Error) => setError(e.message);
    const u1 = data.subscribeSharesByClinician(user.uid, setShares, onError);
    const u2 = user.emailVerified ? data.subscribePendingInvitesForClinician(user.email, setInvites, onError) : (setInvites([]), () => undefined);
    return () => {
      u1();
      u2();
    };
  }, [data, user.uid, user.email, user.emailVerified]);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Patients</h1>
          <p>People who invited you and whose invitation you accepted. Access is read-only and can be revoked by the patient at any time.</p>
        </div>
      </div>

      {!user.emailVerified && (
        <Alert kind="warning" title="Verify your email to receive invitations">
          Invitations are matched to your verified email address.
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                auth.sendEmailVerification().then(
                  () => notify('success', 'Verification email sent.'),
                  (e: unknown) => notify('error', e instanceof Error ? e.message : 'Could not send the email.'),
                )
              }
            >
              <MailCheck aria-hidden /> Send verification email
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refreshUser()}>
              I have verified — refresh
            </button>
          </div>
        </Alert>
      )}

      <section className="card stack" aria-labelledby="pending-title">
        <div className="card-title" id="pending-title">
          Pending invitations
        </div>
        {invites === null ? (
          <div className="skeleton" style={{ height: 60 }} />
        ) : invites.length === 0 ? (
          <EmptyState icon={Inbox} title="No pending invitations" />
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {invites.map((i) => (
              <li key={i.id} className="row row-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.patientName}</div>
                  <div className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                    Invited {fmtDateTime(i.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyId === i.id}
                  onClick={async () => {
                    setBusyId(i.id);
                    try {
                      await data.acceptInvite(i, user.uid, user.email);
                      notify('success', `You can now view ${i.patientName}’s records.`);
                    } catch (e) {
                      notify('error', e instanceof Error ? e.message : 'Could not accept the invitation.');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {busyId === i.id && <span className="spinner" aria-hidden />} Accept
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="patients-title">
        <div className="card-title" id="patients-title">
          Shared with you
        </div>
        {shares === null ? (
          <LoadingCard lines={3} />
        ) : shares.length === 0 ? (
          <EmptyState icon={Users} title="No patients have shared records with you" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Access since</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-strong">
                      <Link to={`/clinician/patients/${s.patientUid}`}>{s.patientName}</Link>
                    </td>
                    <td>{fmtDateTime(s.createdAt)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving(s)}>
                        <UserMinus aria-hidden /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={removing !== null}
        title="Remove this patient?"
        body="You will lose access to their records. The patient would need to invite you again."
        confirmLabel="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await data.removeShareAsClinician(removing);
          notify('success', 'Patient removed.');
        }}
      />
    </div>
  );
}

/** Wraps the patient's pages in a read-only records context for the clinician. */
export function ClinicianPatientLayout() {
  const { patientUid } = useParams();
  if (!patientUid) return null;
  const base = `/clinician/patients/${patientUid}`;
  return (
    <RecordsProvider ownerUid={patientUid} readOnly basePath={base}>
      <PatientHeader base={base} />
      <Outlet />
    </RecordsProvider>
  );
}

function PatientHeader({ base }: { base: string }) {
  const { ownerUid, error } = useRecords();
  const { data } = useServices();
  const [name, setName] = useState<string>('');
  useEffect(() => {
    data.getProfile(ownerUid).then((p) => setName(p?.displayName ?? ''), () => setName(''));
  }, [data, ownerUid]);
  const links = [
    { to: base, label: 'Overview', end: true },
    { to: `${base}/joints`, label: 'Joints & ROM', end: false },
    { to: `${base}/history`, label: 'History', end: false },
    { to: `${base}/analytics`, label: 'Trends', end: false },
    { to: `${base}/reports`, label: 'Reports', end: false },
  ];
  return (
    <div className="page no-print" style={{ paddingBottom: 0 }}>
      <div className="row row-between">
        <div className="row">
          <Link to="/clinician" className="btn btn-ghost btn-sm">
            <ArrowLeft aria-hidden /> All patients
          </Link>
          <strong>{name || 'Patient'}</strong>
          <span className="badge badge-outline">Read-only</span>
        </div>
      </div>
      {error ? (
        <Alert kind="danger" title="Access unavailable" role="alert">
          {error} The patient may have revoked access.
        </Alert>
      ) : (
        <nav className="tabs" aria-label="Patient sections">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="tab" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
