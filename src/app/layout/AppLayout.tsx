import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { NoSensorBadge } from '@/components/ui/Badges';
import { greeting } from '@/domain/format';
import { isBoolean, useLocalStorageState } from '../hooks/useLocalStorageState';
import { useAuth, useSignedInUser } from '../providers/AuthProvider';
import { RecordsProvider } from '../providers/RecordsProvider';
import { useToast } from '../providers/ToastProvider';
import { navFor } from './navigation';
import { ReminderBanner } from './ReminderBanner';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

export const SIDEBAR_STORAGE_KEY = 'rt.sidebarCollapsed';

const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function AppLayout() {
  const { user, profile, role } = useSignedInUser();
  const { signOut } = useAuth();
  const { notify } = useToast();
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>(SIDEBAR_STORAGE_KEY, false, isBoolean);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const name = profile.displayName || user.displayName || user.email;
  const firstName = name.split(/\s+/)[0] ?? name;

  const handleSignOut = () => {
    signOut().catch((e: unknown) => notify('error', e instanceof Error ? e.message : 'Sign-out failed.'));
  };

  const content = (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        groups={navFor(role)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
        userName={name}
        roleLabel={role === 'clinician' ? 'Clinician' : 'Personal account'}
        onSignOut={handleSignOut}
      />
      {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-hidden />}
      <div className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <Menu aria-hidden />
          </button>
          <div className="topbar-title">
            <div className="topbar-greeting">
              {greeting()}, {firstName}
            </div>
            <div className="topbar-date">{dateFmt.format(new Date())}</div>
          </div>
          <div className="topbar-actions">
            {role !== 'clinician' && (
              <span className="hide-sm">
                <NoSensorBadge />
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
          {role !== 'clinician' && <ReminderBanner />}
          <Outlet />
        </main>
      </div>
    </div>
  );

  return role === 'clinician' ? content : <RecordsProvider ownerUid={user.uid}>{content}</RecordsProvider>;
}
