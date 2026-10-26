import { Activity, ClipboardList, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { EMPTY_FILTER_INPUTS, RecordFilters, type FilterInputs } from '@/components/RecordFilters';
import { SourceBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { dateInputsToRange, filterAssessments, filterSessions, type RecordFilter } from '@/domain/filters';
import { fmtDateTime, fmtDeg, fmtDuration, fmtMinutes } from '@/domain/format';
import { jointLabel, movementLabel } from '@/domain/joints';
import type { MovementSession, SymptomAssessment } from '@/domain/types';

export function toRecordFilter(f: FilterInputs): RecordFilter {
  return { joint: f.joint, side: f.side, movement: f.movement, ...dateInputsToRange(f.fromDate, f.toDate) };
}

type Pending = { kind: 'session'; record: MovementSession } | { kind: 'assessment'; record: SymptomAssessment } | null;

export function HistoryPage() {
  const { sessions, assessments, loading, error, readOnly, ownerUid, basePath } = useRecords();
  const { data } = useServices();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'assessments' ? 'assessments' : 'sessions';
  const [filters, setFilters] = useState<FilterInputs>(EMPTY_FILTER_INPUTS);
  const [pending, setPending] = useState<Pending>(null);

  const f = useMemo(() => toRecordFilter(filters), [filters]);
  const ss = useMemo(() => filterSessions(sessions, f), [sessions, f]);
  const as = useMemo(() => filterAssessments(assessments, f), [assessments, f]);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>History</h1>
          <p>Every movement session and symptom check-in is kept as its own timestamped record.</p>
        </div>
      </div>
      <RecordFilters value={filters} onChange={setFilters} showMovement={tab === 'sessions'} />
      <div className="tabs" role="tablist" aria-label="Record type">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'sessions'} onClick={() => setParams({ tab: 'sessions' })} id="tab-sessions" aria-controls="panel-records">
          Movement sessions ({ss.length})
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'assessments'} onClick={() => setParams({ tab: 'assessments' })} id="tab-assessments" aria-controls="panel-records">
          Symptom check-ins ({as.length})
        </button>
      </div>
      <section className="card" id="panel-records" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {loading ? (
          <LoadingCard lines={6} />
        ) : tab === 'sessions' ? (
          ss.length === 0 ? (
            <EmptyState icon={Activity} title={sessions.length === 0 ? 'No movement sessions yet' : 'No sessions match these filters'} action={!readOnly && sessions.length === 0 ? <Link to="/movement/import" className="btn btn-primary">Import movement data</Link> : undefined} />
          ) : (
            <div className="table-wrap">
              <table className="table" data-testid="sessions-table">
                <thead>
                  <tr>
                    <th>Date &amp; time</th>
                    <th>Joint</th>
                    <th>Movement</th>
                    <th>Observed ROM</th>
                    <th>Duration</th>
                    <th>Reps</th>
                    <th>Calibration</th>
                    <th>Source</th>
                    {!readOnly && <th><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {ss.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link to={`${basePath}/sessions/${s.id}`} className="cell-strong">
                          {fmtDateTime(s.startedAt)}
                        </Link>
                      </td>
                      <td>{jointLabel(s.joint, s.side)}</td>
                      <td>{movementLabel(s.movement)}</td>
                      <td className="num cell-strong">{fmtDeg(s.metrics.romDeg)}</td>
                      <td className="num">{fmtDuration(s.metrics.durationMs)}</td>
                      <td className="num">{s.metrics.repetitions ?? '—'}</td>
                      <td>{s.calibrationStatus === 'reference-available' ? 'Reference linked' : 'Not calibrated'}</td>
                      <td>
                        <SourceBadge source={s.source} synthetic={s.isSynthetic} />
                      </td>
                      {!readOnly && (
                        <td>
                          <button type="button" className="icon-btn" aria-label={`Delete session from ${fmtDateTime(s.startedAt)}`} onClick={() => setPending({ kind: 'session', record: s })}>
                            <Trash2 aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : as.length === 0 ? (
          <EmptyState icon={ClipboardList} title={assessments.length === 0 ? 'No symptom check-ins yet' : 'No check-ins match these filters'} action={!readOnly && assessments.length === 0 ? <Link to="/symptoms/new" className="btn btn-primary">Record a check-in</Link> : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="assessments-table">
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Joint</th>
                  <th>Pain</th>
                  <th>Stiffness</th>
                  <th>Discomfort</th>
                  <th>Duration</th>
                  <th>Notes</th>
                  {!readOnly && <th><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {as.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`${basePath}/symptoms/${a.id}`} className="cell-strong">
                        {fmtDateTime(a.assessedAt)}
                      </Link>
                      {a.isSynthetic && <div className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Synthetic sample</div>}
                    </td>
                    <td>{jointLabel(a.joint, a.side)}</td>
                    <td className="num">{a.pain}/10</td>
                    <td className="num">{a.stiffness}/10</td>
                    <td className="num">{a.discomfort}/10</td>
                    <td>{fmtMinutes(a.durationMinutes)}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes || '—'}</td>
                    {!readOnly && (
                      <td>
                        <button type="button" className="icon-btn" aria-label={`Delete check-in from ${fmtDateTime(a.assessedAt)}`} onClick={() => setPending({ kind: 'assessment', record: a })}>
                          <Trash2 aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'session' ? 'Delete this movement session?' : 'Delete this check-in?'}
        body={
          pending?.kind === 'session'
            ? `The ${jointLabel(pending.record.joint, pending.record.side).toLowerCase()} session from ${fmtDateTime(pending.record.startedAt)} and all of its samples will be permanently removed.`
            : pending
              ? `The check-in from ${fmtDateTime(pending.record.assessedAt)} will be permanently removed.`
              : ''
        }
        confirmLabel="Delete"
        danger
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          if (pending.kind === 'session') await data.deleteSession(ownerUid, pending.record);
          else await data.deleteAssessment(ownerUid, pending.record.id);
          notify('success', pending.kind === 'session' ? 'Session deleted.' : 'Check-in deleted.');
        }}
      />
    </div>
  );
}
