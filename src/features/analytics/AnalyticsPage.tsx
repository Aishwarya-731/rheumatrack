import { Info, Sigma } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useSelection } from '@/app/providers/SelectionProvider';
import { useChartTheme } from '@/components/charts/chartTheme';
import { RomTrendChart, SymptomTrendChart } from '@/components/charts/Charts';
import { JointPicker } from '@/components/JointPicker';
import { Alert, EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { SelectField } from '@/components/ui/Fields';
import { ASSOCIATION_CONFIG } from '@/domain/analysisConfig';
import { romSeries, symptomSeries } from '@/domain/analytics';
import { associate, describeStrength, pairObservations, type SymptomMetric } from '@/domain/correlation';
import { fmtDateTime, fmtDeg } from '@/domain/format';
import { jointLabel, movementLabel } from '@/domain/joints';

const METRICS: Array<{ value: SymptomMetric; label: string }> = [
  { value: 'pain', label: 'Pain' },
  { value: 'stiffness', label: 'Stiffness' },
  { value: 'discomfort', label: 'Discomfort' },
];

export function AnalyticsPage() {
  const { sessions, assessments, loading, error } = useRecords();
  const { joint, side, movement } = useSelection();
  const [metric, setMetric] = useState<SymptomMetric>('stiffness');
  const t = useChartTheme();

  const rom = useMemo(() => romSeries(sessions, joint, side, movement), [sessions, joint, side, movement]);
  const sym = useMemo(() => symptomSeries(assessments, joint, side), [assessments, joint, side]);
  const pairs = useMemo(() => pairObservations(sessions, assessments, joint, side, movement, metric), [sessions, assessments, joint, side, movement, metric]);
  const result = useMemo(() => associate(pairs), [pairs]);
  const metricLabel = METRICS.find((m) => m.value === metric)?.label ?? metric;

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  if (loading) return <div className="page"><LoadingCard lines={8} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Trends</h1>
          <p>Compare symptom check-ins with movement sessions for one joint. Associations are descriptive; they do not show cause and are not diagnostic.</p>
        </div>
      </div>
      <div className="card">
        <JointPicker />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Observed ROM — {jointLabel(joint, side)} {movementLabel(movement).toLowerCase()}</div>
              <div className="card-subtitle">{rom.length} session{rom.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          {rom.length === 0 ? <EmptyState icon={Info} title="No sessions for this selection" /> : <RomTrendChart points={rom} />}
        </section>
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Symptoms — {jointLabel(joint, side)}</div>
              <div className="card-subtitle">{sym.length} check-in{sym.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          {sym.length === 0 ? <EmptyState icon={Info} title="No check-ins for this joint" /> : <SymptomTrendChart points={sym} />}
        </section>
      </div>

      <section className="card stack" aria-labelledby="assoc-title">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div>
            <div className="card-title" id="assoc-title">
              Symptom ↔ observed ROM association
            </div>
            <div className="card-subtitle">
              Pairs a check-in with the nearest session for the same joint, side and movement within ±{ASSOCIATION_CONFIG.pairingWindowMs / 3_600_000} hours
            </div>
          </div>
          <div style={{ minWidth: 200 }}>
            <SelectField<SymptomMetric> label="Symptom" value={metric} options={METRICS} onChange={setMetric} />
          </div>
        </div>

        {result.status === 'insufficient' ? (
          <Alert kind="info" title="Not enough paired data for an association" role="status">
            {result.reason} No correlation value is shown until there are at least {ASSOCIATION_CONFIG.minPairs} pairs.
          </Alert>
        ) : (
          <div className="grid grid-3" data-testid="association-result">
            <div className="stat-card">
              <div className="stat-label">Spearman ρ ({metricLabel.toLowerCase()} vs observed ROM)</div>
              <div className="stat-value">{result.rho.toFixed(2)}</div>
              <div className="stat-foot">
                {describeStrength(result.rho)} {result.rho < 0 ? 'negative' : result.rho > 0 ? 'positive' : ''} association
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Paired observations</div>
              <div className="stat-value">{result.n}</div>
              <div className="stat-foot">Each check-in and session used once</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">p-value (two-sided, t approximation)</div>
              <div className="stat-value">{result.pValue < 0.001 ? '<0.001' : result.pValue.toFixed(3)}</div>
              <div className="stat-foot">Not adjusted for repeated testing</div>
            </div>
          </div>
        )}

        {pairs.length > 0 && (
          <div className="grid grid-2">
            <div className="chart-box" data-testid="association-scatter">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 12, bottom: 10, left: -4 }}>
                  <CartesianGrid stroke={t.grid} />
                  <XAxis type="number" dataKey="romDeg" name="Observed ROM" unit="°" tick={t.tick} stroke={t.grid} />
                  <YAxis type="number" dataKey="symptom" name={metricLabel} domain={[0, 10]} tick={t.tick} stroke={t.grid} width={44} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as { romDeg: number; symptom: number; assessmentTime: number } | undefined;
                      if (!active || !p) return null;
                      return (
                        <div className="chart-tooltip">
                          <div className="tt-label">{fmtDateTime(p.assessmentTime)}</div>
                          ROM {fmtDeg(p.romDeg)} · {metricLabel} {p.symptom}/10
                        </div>
                      );
                    }}
                  />
                  <Scatter data={pairs} fill={t.series[1]} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Check-in</th>
                    <th>{metricLabel}</th>
                    <th>Session</th>
                    <th>Observed ROM</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => (
                    <tr key={p.assessmentId}>
                      <td>{fmtDateTime(p.assessmentTime)}</td>
                      <td className="num">{p.symptom}/10</td>
                      <td>{fmtDateTime(p.sessionTime)}</td>
                      <td className="num">{fmtDeg(p.romDeg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <details>
          <summary className="row" style={{ cursor: 'pointer', fontWeight: 600 }}>
            <Sigma aria-hidden style={{ width: 18 }} /> Method and limitations
          </summary>
          <ul className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 8 }}>
            <li>Pairing: each check-in is matched to the session (same joint, side and movement) whose start time is closest, if within ±{ASSOCIATION_CONFIG.pairingWindowMs / 3_600_000} h. Closest pairs are matched first; each record is used at most once. Unmatched records are excluded.</li>
            <li>Statistic: Spearman rank correlation, suited to 0–10 ordinal ratings and not assuming a straight-line relationship. Tied values receive average ranks.</li>
            <li>Shown only with at least {ASSOCIATION_CONFIG.minPairs} pairs and when both variables vary.</li>
            <li>Correlation is not causation. Activity, time of day, medication and recording conditions can all influence both values. Observations from one person over time are not independent, so the p-value is approximate.</li>
            <li>Synthetic sample data, if present, is included in these calculations; remove it in Settings for analyses of your own records only.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
