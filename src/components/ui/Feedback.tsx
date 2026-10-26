import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AlertKind = 'info' | 'warning' | 'danger' | 'success';
const ALERT_ICON: Record<AlertKind, LucideIcon> = { info: Info, warning: AlertTriangle, danger: OctagonAlert, success: CheckCircle2 };

export function Alert({ kind = 'info', title, children, role }: { kind?: AlertKind; title?: string; children?: ReactNode; role?: 'alert' | 'status' }) {
  const Icon = ALERT_ICON[kind];
  return (
    <div className={`alert alert-${kind}`} role={role}>
      <Icon aria-hidden />
      <div>
        {title && <div className="alert-title">{title}</div>}
        {children && <div className="muted">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon aria-hidden />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden />;
}

export function LoadingCard({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div className="card" aria-busy="true" aria-label={label}>
      <div className="stack">
        <Skeleton height={18} width="40%" />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} height={14} width={`${90 - i * 12}%`} />
        ))}
      </div>
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card">
      <Alert kind="danger" title="Could not load data" role="alert">
        {message}
      </Alert>
      {onRetry && (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row" role="status">
      <span className="spinner" aria-hidden />
      {label && <span>{label}</span>}
    </span>
  );
}

export function FullPageLoader({ label = 'Loading RheumaTrack…' }: { label?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Spinner label={label} />
    </div>
  );
}
