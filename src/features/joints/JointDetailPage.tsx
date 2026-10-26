import { ClipboardList, Crosshair, Download, FileText } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { RomTrendChart, SymptomTrendChart } from '@/components/charts/Charts';
import { JointPicker } from '@/components/JointPicker';
import { NoSensorBadge, SourceBadge } from '@/components/ui/Badges';
import { EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { latestPerMovement, romSeries, symptomSeries } from '@/domain/analytics';
import { assessmentsToCsv, exportFileStamp, sessionsToCsv } from '@/domain/export';
import { downloadText } from '@/app/download';
import { fmtDateTime, fmtDeg } from '@/domain/format';
import { isJoint, isSide, JOINT_CATALOGUE, jointLabel, movementLabel } from '@/domain/joints';
import { RomRingsPanel } from './RomRingsPanel';
import { ViewerFallback } from './JointsPage';

const BodyViewer3D = lazy(() => import('@/features/viewer3d/BodyViewer3D'));

export function JointDetailPage() {
  const params = useParams();
  const { sessions, assessments, calibrations, loading, error, readOnly, basePath } = useRecords();
  const sel = useSelection();
  const navigate = useNavigate();
  const validParams = isJoint(params.joint) && isSide(params.side);
  const paramsKey = `${params.joint}:${params.side}`;
  const selKey = `${sel.joint}:${sel.side}`;
  const lastParams = useRef<string | null>(null);
  const lastSel = useRef<string | null>(null);

  // Two-way sync: a URL change updates the shared selection; a selection change (3D model,
  // dropdown, side toggle) updates the URL.
  useEffect(() => {
    if (!isJoint(params.joint) || !isSide(params.side)) return;
    if (paramsKey !== lastParams.current) {
      lastParams.current = paramsKey;
      lastSel.current = paramsKey;
      if (selKey !== paramsKey) sel.select(params.joint, params.side);
      return;
    }
    if (selKey !== lastSel.current) {
      lastSel.current = selKey;
      if (selKey !== paramsKey) navigate(`${basePath}/joints/${sel.joint}/${sel.side}`, { replace: true });
    }
  }, [paramsKey, selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const joint = isJoint(params.joint) ? params.joint : sel.joint;
  const side = isSide(params.side) ? params.side : sel.side;
  const jointSessions = useMemo(() => sessions.filter((s) => s.joint === joint && s.side === side), [sessions, joint, side]);
  const jointAssessments = useMemo(() => assessments.filter((a) => a.joint === joint && a.side === side), [assessments, joint, side]);
  const jointCalibrations = calibrations.filter((c) => c.joint === joint && c.side === side);
  const latest = latestPerMovement(sessions, joint, side).get(sel.movement) ?? null;
  const rom = romSeries(sessions, joint, side, sel.movement);
  const sym = symptomSeries(assessments, joint, side);

  if (!validParams) return <Navigate to={`${basePath}/joints`} replace />;
  if (error) return <div className="page"><ErrorCard message={error} /></div>;

  const stamp = exportFileStamp();
  const def = JOINT_CATALOGUE[joint];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{jointLabel(joint, side)}</h1>
          <p>Supported movements: {def.movements.map((m) => m.label.toLowerCase()).join(', ')}. Movements are supported for tracking; none is presented as clinically validated.</p>
        </div>
        <div className="page-actions">
          <Link to={`${basePath}/reports/clinician?joint=${joint}&side=${side}`} className="btn btn-secondary">
            <FileText aria-hidden /> Report
          </Link>
          <button type="button" className="btn btn-secondary" disabled={jointSessions.length === 0} onClick={() => downloadText(`rheumatrack_${joint}_${side}_sessions_${stamp}.csv`, sessionsToCsv(jointSessions), 'text/csv')}>
            <Download aria-hidden /> Sessions CSV
          </button>
          <button type="button" className="btn btn-secondary" disabled={jointAssessments.length === 0} onClick={() => downloadText(`rheumatrack_${joint}_${side}_checkins_${stamp}.csv`, assessmentsToCsv(jointAssessments), 'text/csv')}>
            <Download aria-hidden /> Check-ins CSV
          </button>
        </div>
      </div>

      <div className="grid grid-main-side">
        <section className="card" aria-label="3D view of the selected joint">
          <Suspense fallback={<ViewerFallback height={460} />}>
            <BodyViewer3D latestSession={latest} height={460} initialFocus />
          </Suspense>
        </section>
        <div className="stack">
          <section className="card stack">
            <JointPicker compact />
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--fs-sm)' }}>
              {def.movements.map((m) => (
                <li key={m.id}>
                  <strong style={{ color: 'var(--text)' }}>{m.label}:</strong> {m.description}
                </li>
              ))}
            </ul>
          </section>
          <section className="card stack">
            <div className="row row-between">
              <div className="card-title">Calibration</div>
              <NoSensorBadge />
            </div>
            {jointCalibrations.filter((c) => c.outcome === 'completed').length === 0 ? (
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>No completed static reference for this joint.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--fs-sm)' }}>
                {jointCalibrations
                  .filter((c) => c.outcome === 'completed')
                  .slice(0, 3)
                  .map((c) => (
                    <li key={c.id}>
                      {movementLabel(c.movement)} · reference {fmtDeg(c.referenceAngleDeg, 2)} · {fmtDateTime(c.createdAt)}
                    </li>
                  ))}
              </ul>
            )}
            {!readOnly && (
              <Link to="/calibration" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
                <Crosshair aria-hidden /> Open calibration
              </Link>
            )}
          </section>
        </div>
      </div>

      <RomRingsPanel />

      {loading ? (
        <LoadingCard lines={6} />
      ) : (
        <div className="grid grid-2">
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">ROM trend — {movementLabel(sel.movement).toLowerCase()}</div>
                <div className="card-subtitle">{rom.length} session(s)</div>
              </div>
            </div>
            {rom.length === 0 ? <EmptyState icon={Crosshair} title="No sessions for this movement" /> : <RomTrendChart points={rom} height={240} />}
          </section>
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Symptom history</div>
                <div className="card-subtitle">{sym.length} check-in(s)</div>
              </div>
              {!readOnly && (
                <Link to="/symptoms/new" className="btn btn-ghost btn-sm">
                  New check-in
                </Link>
              )}
            </div>
            {sym.length === 0 ? <EmptyState icon={ClipboardList} title="No check-ins for this joint" /> : <SymptomTrendChart points={sym} height={240} />}
          </section>
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <div className="card-title">Session history</div>
        </div>
        {jointSessions.length === 0 ? (
          <EmptyState icon={Crosshair} title="No movement sessions for this joint" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Movement</th>
                  <th>Observed ROM</th>
                  <th>Reps</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {jointSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`${basePath}/sessions/${s.id}`} className="cell-strong">
                        {fmtDateTime(s.startedAt)}
                      </Link>
                    </td>
                    <td>{movementLabel(s.movement)}</td>
                    <td className="num cell-strong">{fmtDeg(s.metrics.romDeg)}</td>
                    <td className="num">{s.metrics.repetitions ?? '—'}</td>
                    <td>
                      <SourceBadge source={s.source} synthetic={s.isSynthetic} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
