import { ClipboardList, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useSignedInUser } from '@/app/providers/AuthProvider';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { SyntheticBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { fmtDateTime, fmtMinutes } from '@/domain/format';
import { jointLabel } from '@/domain/joints';
import { toLocalDateTimeInput, type SymptomFormValues } from '@/domain/symptoms';
import type { SymptomAssessment } from '@/domain/types';
import { SymptomForm } from './SymptomForm';

export function NewSymptomPage() {
  const { user } = useSignedInUser();
  const { data } = useServices();
  const { notify } = useToast();
  const { joint, side, select } = useSelection();
  const navigate = useNavigate();
  const [initial] = useState<SymptomFormValues>(() => ({
    joint,
    side,
    pain: 0,
    stiffness: 0,
    discomfort: 0,
    durationMinutes: '',
    notes: '',
    assessedAtLocal: toLocalDateTimeInput(Date.now()),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Symptom check-in</h1>
          <p>Rate how this joint feels. Each check-in is saved as a new, timestamped record; earlier check-ins are never overwritten.</p>
        </div>
      </div>
      <div className="grid grid-main-side">
        <section className="card" style={{ padding: 28 }}>
          <SymptomForm
            initial={initial}
            submitLabel="Save check-in"
            onJointChange={(j, s) => select(j, s)}
            onSubmit={async (v) => {
              const id = await data.createAssessment(user.uid, v);
              notify('success', `Check-in saved for ${jointLabel(v.joint, v.side).toLowerCase()}.`);
              navigate(`/symptoms/${id}`);
            }}
          />
        </section>
        <aside className="card stack" aria-label="How scores are used">
          <div className="card-title">About these scores</div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Each symptom uses the same 0–10 scale: 0 means none and 10 means the worst you can imagine. Scores are stored exactly as you enter
            them. They are not added together, not turned into a risk score, and do not indicate any diagnosis.
          </p>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Recording at similar times of day makes trends easier to compare. If you also import a movement recording within two hours of a
            check-in for the same joint, the Trends page can compare the two once enough pairs exist.
          </p>
        </aside>
      </div>
    </div>
  );
}

function scoreBar(v: number) {
  return (
    <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }} aria-hidden>
        <div style={{ width: `${v * 10}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
      <strong className="num">{v}/10</strong>
    </div>
  );
}

export function SymptomDetailPage() {
  const { id } = useParams();
  const { assessments, loading, error, readOnly, ownerUid, basePath } = useRecords();
  const { data } = useServices();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  if (loading) return <div className="page"><LoadingCard lines={6} /></div>;
  const a: SymptomAssessment | undefined = assessments.find((x) => x.id === id);
  if (!a) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState icon={ClipboardList} title="Check-in not found" action={<Link to={`${basePath}/history`} className="btn btn-secondary">Go to history</Link>}>
            This check-in does not exist or has been deleted.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Check-in · {jointLabel(a.joint, a.side)}</h1>
          <p>
            Assessed {fmtDateTime(a.assessedAt)}
            {a.updatedAt !== null && ` · edited ${fmtDateTime(a.updatedAt)}`}
          </p>
        </div>
        {!readOnly && !editing && (
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Edit
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--danger)' }}>
              <Trash2 aria-hidden /> Delete
            </button>
          </div>
        )}
      </div>
      {a.isSynthetic && (
        <div>
          <SyntheticBadge />
        </div>
      )}
      <section className="card" style={{ padding: 28, maxWidth: 820 }}>
        {editing ? (
          <SymptomForm
            initial={{
              joint: a.joint,
              side: a.side,
              pain: a.pain,
              stiffness: a.stiffness,
              discomfort: a.discomfort,
              durationMinutes: a.durationMinutes === null ? '' : String(a.durationMinutes),
              notes: a.notes,
              assessedAtLocal: toLocalDateTimeInput(a.assessedAt),
            }}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (v) => {
              await data.updateAssessment(ownerUid, a.id, v);
              notify('success', 'Check-in updated.');
              setEditing(false);
            }}
          />
        ) : (
          <div className="stack" style={{ gap: 20 }}>
            <dl className="kv">
              <dt>Pain</dt>
              <dd>{scoreBar(a.pain)}</dd>
              <dt>Stiffness</dt>
              <dd>{scoreBar(a.stiffness)}</dd>
              <dt>Discomfort</dt>
              <dd>{scoreBar(a.discomfort)}</dd>
              <dt>Duration</dt>
              <dd>{fmtMinutes(a.durationMinutes)}</dd>
              <dt>Joint</dt>
              <dd>{jointLabel(a.joint, a.side)}</dd>
              <dt>Recorded</dt>
              <dd>{fmtDateTime(a.createdAt)}</dd>
              <dt>Notes</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{a.notes || <span className="subtle">None</span>}</dd>
            </dl>
            <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
              Self-rated on a 0–10 scale. These scores are personal observations and are not diagnostic.
            </p>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this check-in?"
        body="This permanently removes the check-in. Other check-ins and movement sessions are not affected."
        confirmLabel="Delete check-in"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await data.deleteAssessment(ownerUid, a.id);
          notify('success', 'Check-in deleted.');
          navigate(`${basePath}/history?tab=assessments`, { replace: true });
        }}
      />
    </div>
  );
}
