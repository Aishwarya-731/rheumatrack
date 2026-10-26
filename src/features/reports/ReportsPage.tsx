import { FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useRecords } from '@/app/providers/RecordsProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { EMPTY_FILTER_INPUTS, RecordFilters, type FilterInputs } from '@/components/RecordFilters';
import { Alert, ErrorCard, LoadingCard } from '@/components/ui/Feedback';
import { assessmentsToCsv, buildExportBundle, exportFileStamp, sessionsToCsv } from '@/domain/export';
import { downloadText } from '@/app/download';
import { filterAssessments, filterSessions } from '@/domain/filters';
import { toRecordFilter } from '../history/HistoryPage';

export function filtersToQuery(f: FilterInputs): string {
  const p = new URLSearchParams();
  if (f.joint !== 'all') p.set('joint', f.joint);
  if (f.side !== 'all') p.set('side', f.side);
  if (f.movement !== 'all') p.set('movement', f.movement);
  if (f.fromDate) p.set('from', f.fromDate);
  if (f.toDate) p.set('to', f.toDate);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function ReportsPage() {
  const { sessions, assessments, loading, error, basePath } = useRecords();
  const { notify } = useToast();
  const [filters, setFilters] = useState<FilterInputs>(EMPTY_FILTER_INPUTS);
  const f = useMemo(() => toRecordFilter(filters), [filters]);
  const ss = useMemo(() => filterSessions(sessions, f), [sessions, f]);
  const as = useMemo(() => filterAssessments(assessments, f), [assessments, f]);
  const stamp = exportFileStamp();
  const syntheticIncluded = ss.some((s) => s.isSynthetic) || as.some((a) => a.isSynthetic);

  if (error) return <div className="page"><ErrorCard message={error} /></div>;
  if (loading) return <div className="page"><LoadingCard lines={6} /></div>;

  const filterMeta = { joint: filters.joint, side: filters.side, movement: filters.movement, from: filters.fromDate || null, to: filters.toDate || null };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports &amp; export</h1>
          <p>Export exactly the records shown in the app. Every row states its data source and whether it is synthetic.</p>
        </div>
      </div>
      <RecordFilters value={filters} onChange={setFilters} />
      <p className="muted" aria-live="polite">
        Selected: <strong>{ss.length}</strong> movement session{ss.length === 1 ? '' : 's'} and <strong>{as.length}</strong> symptom check-in{as.length === 1 ? '' : 's'}. The movement filter applies to sessions only.
      </p>
      {syntheticIncluded && (
        <Alert kind="warning" title="Synthetic sample data included">
          Some selected records are synthetic. They are marked in every export (<code>synthetic = true</code>).
        </Alert>
      )}

      <div className="grid grid-3">
        <section className="card stack">
          <FileText aria-hidden style={{ color: 'var(--accent)' }} />
          <div className="card-title">Clinician report</div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            A printable summary of the selected records with trends, data sources and method notes. Use your browser’s print dialog to save it as PDF.
          </p>
          <Link to={`${basePath}/reports/clinician${filtersToQuery(filters)}`} className="btn btn-primary" aria-disabled={ss.length + as.length === 0} onClick={(e) => ss.length + as.length === 0 && e.preventDefault()}>
            Open report
          </Link>
        </section>
        <section className="card stack">
          <FileSpreadsheet aria-hidden style={{ color: 'var(--accent)' }} />
          <div className="card-title">CSV export</div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            One file for sessions (metrics and provenance) and one for check-ins. Values are written at full precision.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={ss.length === 0}
              onClick={() => {
                downloadText(`rheumatrack_sessions_${stamp}.csv`, sessionsToCsv(ss), 'text/csv');
                notify('success', `Exported ${ss.length} session${ss.length === 1 ? '' : 's'}.`);
              }}
            >
              Sessions CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={as.length === 0}
              onClick={() => {
                downloadText(`rheumatrack_checkins_${stamp}.csv`, assessmentsToCsv(as), 'text/csv');
                notify('success', `Exported ${as.length} check-in${as.length === 1 ? '' : 's'}.`);
              }}
            >
              Check-ins CSV
            </button>
          </div>
        </section>
        <section className="card stack">
          <FileJson aria-hidden style={{ color: 'var(--accent)' }} />
          <div className="card-title">JSON export</div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Sessions and check-ins in one structured file, including the filters used and a provenance notice.</p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={ss.length + as.length === 0}
            onClick={() => {
              downloadText(`rheumatrack_export_${stamp}.json`, JSON.stringify(buildExportBundle(ss, as, filterMeta), null, 2), 'application/json');
              notify('success', 'JSON export downloaded.');
            }}
          >
            Download JSON
          </button>
        </section>
      </div>
      <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
        Raw samples for an individual session can be downloaded from that session’s page. Exports are files on your device; sharing with a clinician inside RheumaTrack is done from the Sharing page and requires your explicit invitation.
      </p>
    </div>
  );
}
