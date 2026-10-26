import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Alert, FullPageLoader } from '@/components/ui/Feedback';
import type { Role } from '@/domain/types';
import { useAuth } from '../providers/AuthProvider';

/** Only signed-in users with a loaded profile get through; others go to /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, error, retry, signOut } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
        <div className="card" style={{ maxWidth: 480 }}>
          <Alert kind="danger" title="Your account could not be loaded" role="alert">
            {error ?? 'Unknown error.'}
          </Alert>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={retry}>
              Try again
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (status === 'signed-out') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

/**
 * Restricts a route to one role. The role comes from the server-side roles collection;
 * Firestore Security Rules enforce the same restriction on the data itself.
 */
export function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth();
  if (auth.role !== role) return <Navigate to={auth.role === 'clinician' ? '/clinician' : '/'} replace />;
  return <>{children}</>;
}

/** Sign-in pages: signed-in users are sent to their home page. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { status, role } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'signed-in') {
    const from = (location.state as { from?: string } | null)?.from;
    const home = role === 'clinician' ? '/clinician' : '/';
    return <Navigate to={from && from !== '/login' ? from : home} replace />;
  }
  return <>{children}</>;
}
