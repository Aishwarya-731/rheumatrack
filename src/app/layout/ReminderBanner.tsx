import { BellRing, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { dueOccurrence } from '@/domain/reminders';
import { useSignedInUser } from '../providers/AuthProvider';
import { useRecords } from '../providers/RecordsProvider';

const DISMISS_KEY = 'rt.reminderDismissed';
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/**
 * In-app check-in reminder. Shown only while the app is open, when a scheduled check-in time
 * in the last 24 h has passed and no assessment has been saved since. Re-evaluated every minute.
 */
export function ReminderBanner() {
  const { profile } = useSignedInUser();
  const { assessments, loading } = useRecords();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(DISMISS_KEY));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (loading || location.pathname.startsWith('/symptoms/new')) return null;
  const lastCreated = assessments.reduce<number | null>((max, a) => (max === null || a.createdAt > max ? a.createdAt : max), null);
  const due = dueOccurrence(profile.reminders, now, lastCreated);
  if (due === null || due === dismissed) return null;

  const dismiss = () => {
    setDismissed(due);
    try {
      localStorage.setItem(DISMISS_KEY, String(due));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <div className="alert alert-info" role="status">
        <BellRing aria-hidden />
        <div style={{ flex: 1 }}>
          <div className="alert-title">Check-in reminder</div>
          <div className="muted">
            Your scheduled check-in time ({timeFmt.format(due)}) has passed. <Link to="/symptoms/new">Record a symptom check-in</Link>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss} aria-label="Dismiss reminder">
          <X aria-hidden />
        </button>
      </div>
    </div>
  );
}
