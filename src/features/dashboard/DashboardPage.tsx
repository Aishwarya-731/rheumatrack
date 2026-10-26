import { Activity, ClipboardList, ClipboardPlus, Gauge, PersonStanding, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { LeftRightChart, RomTrendChart, SymptomTrendChart } from '@/components/charts/Charts';
import { JointPicker } from '@/components/JointPicker';
import { SourceBadge, SyntheticBadge } from '@/components/ui/Badges';
import { EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { Segmented } from '@/components/ui/Fields';
import { StatCard } from '@/components/ui/StatCard';
import { dailyCounts, jointSummaries, leftRightComparison, recentActivity, romSeries, summarise, symptomSeries } from '@/domain/analytics';
import { filterAssessments, filterSessions, presetRange, RANGE_PRESETS, EMPTY_FILTER, type RangePreset } from '@/domain/filters';
import { fmtDeg, fmtDateTime, fmtRelative } from '@/domain/format';
import { jointLabel, movementLabel } from '@/domain/joints';

export function DashboardPage() {
  const { sessions, assessments, loading, error, readOnly, basePath } = useRecords();
  const { joint, side, movement } = useSelection();
  const navigate = useNavigate();
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [now] = useState(() => Date.now());

  const range = useMemo(() => presetRange(preset, now), [preset, now]);
  const ss = useMemo(() => filterSessions(sessions, { ...EMPTY_FILTER, ...range }), [sessions, range]);
  const as = useMemo(() => filterAssessments(assessments, { ...EMPTY_FILTER, ...range }), [assessments, range]);
  const summary = useMemo(() => summarise(ss, as), [ss, as]);
  const sparkFrom = range.from ?? Math.min(now - 13 * 86_400_000, ...ss.map((s) => s.startedAt), ...as.map((a) => a.assessedAt));
  const sessionDays = useMemo(() => dailyCounts(ss.map((s) => s.startedAt), Math.max(sparkFrom, now - 13 * 86_400_000), now), [ss, sparkFrom, now]);
  const assessmentDays = useMemo(() => dailyCounts(as.map((a) => a.assessedAt), Math.max(sparkFrom, now - 13 * 86_400_000), now), [as, sparkFrom, now]);
  const rom = useMemo(() => romSeries(ss, joint, side, movement), [ss, joint, side, movement]);
  const symptoms = useMemo(() => symptomSeries(as, joint, side), [as, joint, side]);
  const lr = useMemo(() => leftRightComparison(ss), [ss]);
  const joints = useMemo(() => jointSummaries(ss, as), [ss, as]);
  const activity = useMemo(() => recentActivity(ss, as, 6), [ss, as]);
  const hasSynthetic = sessions.some((s) => s.isSynthetic) || assessments.some((a) => a.isSynthetic);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  if (loading) {
    return (
      <div className="page" aria-busy="true">
        <div className="grid grid-4">
          {[0, 1, 2, 3].map((i) => <LoadingCard key={i} lines={2} />)}
        </div>
        <div className="grid grid-2">
          <LoadingCard lines={6} />
          <LoadingCard lines={6} />
        </div>
      </div>
    );
  }

  const nothingYet = sessions.length === 0 && assessments.length === 0;
  const latest = summary.latestSession;
  const rangeText = preset === 'all' ? 'all time' : `last ${preset.replace('d', '')} days`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Observed values from your own records. Nothing here is a diagnosis.</p>
        </div>
        <div className="page-actions">
          <Segmented<RangePreset> label="Date range" value={preset} options={RANGE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} onChange={setPreset} />
          {!readOnly && (
            <>
              <Link to="/symptoms/new" className="btn btn-primary">
                <ClipboardPlus aria-hidden /> Check-in
              </Link>
              <Link to="/movement/import" className="btn btn-secondary">
                <Upload aria-hidden /> Import movement
              </Link>
            </>
          )}
        </div>
      </div>

      {hasSynthetic && (
        <div className="row">
          <SyntheticBadge />
          <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            Some records are synthetic sample data.{!readOnly && <> Remove them in <Link to="/settings">Settings</Link>.</>}
          </span>
        </div>
      )}

      {nothingYet ? (
        <div className="card">
          <EmptyState
            icon={Activity}
            title="No records yet"
            action={
              !readOnly && (
                <div className="row" style={{ justifyContent: 'center' }}>
                  <Link to="/symptoms/new" className="btn btn-primary">
                    <ClipboardPlus aria-hidden /> Record a symptom check-in
                  </Link>
                  <Link to="/movement/import" className="btn btn-secondary">
                    <Upload aria-hidden /> Import movement data
                  </Link>
                  <Link to="/joints" className="btn btn-ghost">
                    <PersonStanding aria-hidden /> Explore joints
                  </Link>
                </div>
              )
            }
          >
            Your dashboard fills in as you record symptom check-ins and import joint-angle recordings. No example numbers are shown.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-4">
            <StatCard
              icon={Activity}
              label="Movement sessions"
              value={summary.sessionCount}
              foot={`In the ${rangeText}`}
              color="var(--chart-1)"
              spark={{ values: sessionDays.map((d) => d.count), label: 'Sessions per day, last 14 days' }}
            />
            <StatCard
              icon={PersonStanding}
              label="Joints tracked"
              value={summary.jointsTracked}
              foot="Joint sides with any record"
              color="var(--chart-4)"
            />
            <StatCard
              icon={Gauge}
              label="Latest observed ROM"
              value={latest ? fmtDeg(latest.metrics.romDeg) : '—'}
              foot={latest ? `${jointLabel(latest.joint, latest.side)} ${movementLabel(latest.movement).toLowerCase()} · ${fmtRelative(latest.startedAt, now)}` : 'No session in range'}
              color="var(--chart-3)"
            />
            <StatCard
              icon={ClipboardList}
              label="Symptom check-ins"
              value={summary.assessmentCount}
              foot={`In the ${rangeText}`}
              color="var(--chart-2)"
              spark={{ values: assessmentDays.map((d) => d.count), label: 'Check-ins per day, last 14 days' }}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Trends for the selected joint</div>
                <div className="card-subtitle">Choose a joint, side and movement. All panels below use this selection.</div>
              </div>
            </div>
            <JointPicker />
          </div>

          <div className="grid grid-2">
            <section className="card" aria-labelledby="rom-trend-title">
              <div className="card-header">
                <div>
                  <div className="card-title" id="rom-trend-title">
                    Observed ROM — {jointLabel(joint, side)} {movementLabel(movement).toLowerCase()}
                  </div>
                  <div className="card-subtitle">One point per movement session (max − min angle)</div>
                </div>
              </div>
              {rom.length === 0 ? (
                <EmptyState icon={Gauge} title="No sessions for this selection">
                  Import a recording for this joint and movement to see its trend.
                </EmptyState>
              ) : (
                <RomTrendChart points={rom} />
              )}
            </section>
            <section className="card" aria-labelledby="sym-trend-title">
              <div className="card-header">
                <div>
                  <div className="card-title" id="sym-trend-title">
                    Pain, stiffness &amp; discomfort — {jointLabel(joint, side)}
                  </div>
                  <div className="card-subtitle">Self-rated 0–10 per check-in</div>
                </div>
              </div>
              {symptoms.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No check-ins for this joint">
                  Symptom check-ins for this joint and side will appear here.
                </EmptyState>
              ) : (
                <SymptomTrendChart points={symptoms} />
              )}
            </section>
          </div>

          <div className="grid grid-main-side">
            <section className="card" aria-labelledby="recent-sessions-title">
              <div className="card-header">
                <div>
                  <div className="card-title" id="recent-sessions-title">
                    Recent movement sessions
                  </div>
                  <div className="card-subtitle">Newest first, {rangeText}</div>
                </div>
                <Link to={`${basePath}/history`} className="btn btn-ghost btn-sm">
                  View all
                </Link>
              </div>
              {ss.length === 0 ? (
                <EmptyState icon={Activity} title="No sessions in this range" />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Joint</th>
                        <th>Movement</th>
                        <th>Observed ROM</th>
                        <th>Source</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ss.slice(0, 6).map((s) => (
                        <tr key={s.id} className="clickable" onClick={() => navigate(`${basePath}/sessions/${s.id}`)}>
                          <td className="cell-strong">
                            <Link to={`${basePath}/sessions/${s.id}`} onClick={(e) => e.stopPropagation()}>
                              {jointLabel(s.joint, s.side)}
                            </Link>
                          </td>
                          <td>{movementLabel(s.movement)}</td>
                          <td className="num cell-strong">{fmtDeg(s.metrics.romDeg)}</td>
                          <td>
                            <SourceBadge source={s.source} synthetic={s.isSynthetic} />
                          </td>
                          <td className="muted">{fmtDateTime(s.startedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="activity-title">
              <div className="card-header">
                <div className="card-title" id="activity-title">
                  Recent activity
                </div>
              </div>
              {activity.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No activity in this range" />
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
                  {activity.map((item) => (
                    <li key={`${item.kind}-${item.record.id}`} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <span className="stat-icon" style={{ ['--stat-color' as string]: item.kind === 'session' ? 'var(--chart-1)' : 'var(--chart-2)', width: 34, height: 34 }}>
                        {item.kind === 'session' ? <Activity aria-hidden /> : <ClipboardList aria-hidden />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        {item.kind === 'session' ? (
                          <Link to={`${basePath}/sessions/${item.record.id}`} className="cell-strong">
                            Imported {jointLabel(item.record.joint, item.record.side).toLowerCase()} {movementLabel(item.record.movement).toLowerCase()} · {fmtDeg(item.record.metrics.romDeg)}
                          </Link>
                        ) : (
                          <Link to={`${basePath}/symptoms/${item.record.id}`} className="cell-strong">
                            Check-in: {jointLabel(item.record.joint, item.record.side).toLowerCase()} · pain {item.record.pain}/10
                          </Link>
                        )}
                        <div className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
                          {fmtDateTime(item.at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid grid-2">
            <section className="card" aria-labelledby="lr-title">
              <div className="card-header">
                <div>
                  <div className="card-title" id="lr-title">
                    Left / right comparison
                  </div>
                  <div className="card-subtitle">Latest observed ROM per side, shown only where both sides have the same movement recorded</div>
                </div>
              </div>
              {lr.length === 0 ? (
                <EmptyState icon={PersonStanding} title="Not enough comparable data">
                  Record the same movement on both the left and right side to compare them.
                </EmptyState>
              ) : (
                <LeftRightChart rows={lr} />
              )}
            </section>
            <section className="card" aria-labelledby="joints-title">
              <div className="card-header">
                <div>
                  <div className="card-title" id="joints-title">
                    Joint comparison
                  </div>
                  <div className="card-subtitle">Per joint side, {rangeText}</div>
                </div>
              </div>
              {joints.length === 0 ? (
                <EmptyState icon={PersonStanding} title="No joints recorded in this range" />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Joint</th>
                        <th>Sessions</th>
                        <th>Latest ROM</th>
                        <th>Check-ins</th>
                        <th>Latest pain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {joints.map((r) => (
                        <tr key={`${r.joint}-${r.side}`}>
                          <td className="cell-strong">
                            <Link to={`${basePath}/joints/${r.joint}/${r.side}`}>{jointLabel(r.joint, r.side)}</Link>
                          </td>
                          <td className="num">{r.sessionCount}</td>
                          <td className="num">{r.latestRom ? `${fmtDeg(r.latestRom.romDeg)} (${movementLabel(r.latestRom.movement).toLowerCase()})` : '—'}</td>
                          <td className="num">{r.assessmentCount}</td>
                          <td className="num">{r.latestPain ? `${r.latestPain.value}/10` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
