import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useServices } from '@/app/providers/ServicesProvider';
import { AngleTimeChart, RomTrendChart } from '@/components/charts/Charts';
import { BrandMark } from '@/components/BrandMark';
import { ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { romSeries } from '@/domain/analytics';
import { EXPORT_NOTICE } from '@/domain/export';
import { filterAssessments, filterSessions, dateInputsToRange, type RecordFilter } from '@/domain/filters';
import { fmtDate, fmtDateTime, fmtDeg, fmtDuration, fmtMinutes, fmtNumber } from '@/domain/format';
import { isJoint, isMovement, isSide, jointLabel, movementLabel, type Joint, type Movement, type Side } from '@/domain/joints';
import { DATA_SOURCE_LABEL, type AngleSample } from '@/domain/types';

function ReportShell({ title, backTo, children, owner }: { title: string; backTo: string; children: ReactNode; owner: string }) {
  return (
    <div className="page">
      <div className="row row-between no-print">
        <Link to={backTo} className="btn btn-ghost">
          <ArrowLeft aria-hidden /> Back
        </Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer aria-hidden /> Print / save as PDF
        </button>
      </div>
      <article className="card stack report" style={{ padding: 32, gap: 24 }}>
        <header className="row row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="row" style={{ color: 'var(--accent)' }}>
              <BrandMark size={22} />
              <strong>RheumaTrack</strong>
            </div>
            <h1 style={{ marginTop: 12 }}>{title}</h1>
            <p className="muted">
              {owner} · generated {fmtDateTime(Date.now())}
            </p>
          </div>
        </header>
        <div className="alert alert-info" style={{ fontSize: 'var(--fs-sm)' }}>
          <div>
            <div className="alert-title">How to read this report</div>
            <div className="muted">{EXPORT_NOTICE}</div>
          </div>
        </div>
        {children}
      </article>
    </div>
  );
}

export function ClinicianReportPage() {
  const { sessions, assessments, loading, error, ownerUid, basePath } = useRecords();
  const { data } = useServices();
  const [params] = useSearchParams();
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    data.getProfile(ownerUid).then((p) => setOwnerName(p?.displayName ?? ''), () => setOwnerName(''));
  }, [data, ownerUid]);

  const filter: RecordFilter = useMemo(() => {
    const j = params.get('joint');
    const s = params.get('side');
    const m = params.get('movement');
    return {
      joint: isJoint(j) ? j : 'all',
      side: isSide(s) ? s : 'all',
      movement: isMovement(m) ? m : 'all',
      ...dateInputsToRange(params.get('from') ?? '', params.get('to') ?? ''),
    };
  }, [params]);
  const ss = useMemo(() => filterSessions(sessions, filter), [sessions, filter]);
  const as = useMemo(() => filterAssessments(assessments, filter), [assessments, filter]);
  const groups = useMemo(() => {
    const map = new Map<string, { joint: Joint; side: Side; movement: Movement }>();
    for (const s of ss) map.set(`${s.joint}|${s.side}|${s.movement}`, { joint: s.joint, side: s.side, movement: s.movement });
    return [...map.values()];
  }, [ss]);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  if (loading) return <div className="page"><LoadingCard lines={8} /></div>;

  const times = [...ss.map((s) => s.startedAt), ...as.map((a) => a.assessedAt)];
  const period = times.length ? `${fmtDate(Math.min(...times))} – ${fmtDate(Math.max(...times))}` : 'No records';

  return (
    <ReportShell title="Joint mobility & symptom report" backTo={`${basePath}/reports`} owner={ownerName || 'RheumaTrack user'}>
      <dl className="kv">
        <dt>Period</dt>
        <dd>{period}</dd>
        <dt>Filters</dt>
        <dd>
          {filter.joint === 'all' ? 'All joints' : filter.joint}, {filter.side === 'all' ? 'both sides' : filter.side}, {filter.movement === 'all' ? 'all movements' : filter.movement}
        </dd>
        <dt>Records</dt>
        <dd>
          {ss.length} movement sessions ({ss.filter((s) => s.isSynthetic).length} synthetic) · {as.length} symptom check-ins ({as.filter((a) => a.isSynthetic).length} synthetic)
        </dd>
      </dl>

      <section className="stack">
        <h2>Observed range of motion</h2>
        {groups.length === 0 && <p className="muted">No movement sessions in this selection.</p>}
        {groups.map((g) => {
          const pts = romSeries(ss, g.joint, g.side, g.movement);
          return (
            <div key={`${g.joint}-${g.side}-${g.movement}`} className="stack" style={{ breakInside: 'avoid' }}>
              <h3>
                {jointLabel(g.joint, g.side)} — {movementLabel(g.movement).toLowerCase()} ({pts.length} session{pts.length === 1 ? '' : 's'})
              </h3>
              {pts.length > 1 && <RomTrendChart points={pts} height={200} />}
            </div>
          );
        })}
        {ss.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Joint / movement</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Observed ROM</th>
                  <th>Reps</th>
                  <th>Data source</th>
                </tr>
              </thead>
              <tbody>
                {ss.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtDateTime(s.startedAt)}</td>
                    <td>
                      {jointLabel(s.joint, s.side)} {movementLabel(s.movement).toLowerCase()}
                    </td>
                    <td className="num">{fmtDeg(s.metrics.minDeg)}</td>
                    <td className="num">{fmtDeg(s.metrics.maxDeg)}</td>
                    <td className="num cell-strong">{fmtDeg(s.metrics.romDeg)}</td>
                    <td className="num">{s.metrics.repetitions ?? '—'}</td>
                    <td>
                      {DATA_SOURCE_LABEL[s.source]}
                      {s.isSynthetic ? ' · synthetic' : ''}
                      {s.calibrationStatus === 'reference-available' ? ' · static reference linked' : ' · not calibrated'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack">
        <h2>Symptom check-ins</h2>
        {as.length === 0 ? (
          <p className="muted">No check-ins in this selection.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Joint</th>
                  <th>Pain</th>
                  <th>Stiffness</th>
                  <th>Discomfort</th>
                  <th>Duration</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {as.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDateTime(a.assessedAt)}</td>
                    <td>{jointLabel(a.joint, a.side)}{a.isSynthetic ? ' · synthetic' : ''}</td>
                    <td className="num">{a.pain}/10</td>
                    <td className="num">{a.stiffness}/10</td>
                    <td className="num">{a.discomfort}/10</td>
                    <td>{fmtMinutes(a.durationMinutes)}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack" style={{ fontSize: 'var(--fs-sm)' }}>
        <h2>Method notes</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Observed ROM = maximum − minimum angle within one recording. It has not been validated against a clinical goniometric reference.</li>
          <li>Symptom scores are self-rated on 0–10 numeric scales (0 = none, 10 = worst imaginable) and are not combined or interpreted diagnostically.</li>
          <li>“Imported movement data” comes from files supplied by the user; “Simulation-generated data” is synthetic. No sensor hardware was connected.</li>
        </ul>
      </section>
    </ReportShell>
  );
}

export function SessionReportPage() {
  const { id } = useParams();
  const { sessions, loading, error, ownerUid, basePath } = useRecords();
  const { data } = useServices();
  const session = sessions.find((s) => s.id === id);
  const [samples, setSamples] = useState<AngleSample[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    data.getProfile(ownerUid).then((p) => setOwnerName(p?.displayName ?? ''), () => setOwnerName(''));
  }, [data, ownerUid]);
  useEffect(() => {
    if (!session) return;
    data.getSessionSamples(ownerUid, session).then(setSamples, (e: unknown) => setLoadError(e instanceof Error ? e.message : 'Could not load samples.'));
  }, [data, ownerUid, session]);

  if (error || loadError) return <div className="page"><ErrorCard message={error ?? loadError ?? ''} /></div>;
  if (loading) return <div className="page"><LoadingCard lines={8} /></div>;
  if (!session) return <div className="page"><ErrorCard message="This session does not exist or has been deleted." /></div>;
  const m = session.metrics;

  return (
    <ReportShell title={`Movement session — ${jointLabel(session.joint, session.side)} ${movementLabel(session.movement).toLowerCase()}`} backTo={`${basePath}/sessions/${session.id}`} owner={ownerName || 'RheumaTrack user'}>
      <dl className="kv">
        <dt>Recorded</dt>
        <dd>{fmtDateTime(session.startedAt)}</dd>
        <dt>Data source</dt>
        <dd>
          {DATA_SOURCE_LABEL[session.source]}
          {session.isSynthetic ? ' — synthetic sample data' : ''}
        </dd>
        <dt>Source file</dt>
        <dd>{session.sourceFileName ?? '—'}</dd>
        <dt>Calibration</dt>
        <dd>{session.calibrationStatus === 'reference-available' ? 'Static reference linked (metadata only)' : 'Not calibrated'}</dd>
        <dt>Observed ROM</dt>
        <dd className="num">
          <strong>{fmtDeg(m.romDeg, 2)}</strong> (max {fmtDeg(m.maxDeg, 2)} − min {fmtDeg(m.minDeg, 2)})
        </dd>
        <dt>Mean angle</dt>
        <dd className="num">{fmtDeg(m.meanDeg, 2)}</dd>
        <dt>Repetitions</dt>
        <dd>{m.repetitions ?? m.repetitionNote}</dd>
        <dt>Duration</dt>
        <dd>{fmtDuration(m.durationMs)}</dd>
        <dt>Samples</dt>
        <dd className="num">
          {m.sampleCount.toLocaleString('en')} at {fmtNumber(m.interval.rateHz, 1)} Hz; {m.quality.irregularIntervals} irregular interval(s)
        </dd>
        <dt>Notes</dt>
        <dd style={{ whiteSpace: 'pre-wrap' }}>{session.notes || '—'}</dd>
      </dl>
      {samples ? <AngleTimeChart samples={samples} cursorMs={null} height={260} /> : <div className="skeleton" style={{ height: 260 }} />}
    </ReportShell>
  );
}
