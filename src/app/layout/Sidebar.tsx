import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { useState, type FocusEvent, type MouseEvent } from 'react';
import { NavLink } from 'react-router';
import { BrandMark } from '@/components/BrandMark';
import type { NavGroup } from './navigation';

interface SidebarProps {
  groups: NavGroup[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onNavigate: () => void;
  userName: string;
  roleLabel: string;
  onSignOut: () => void;
}

interface TipState {
  text: string;
  top: number;
  left: number;
}

export function Sidebar({ groups, collapsed, onToggleCollapsed, mobileOpen, onNavigate, userName, roleLabel, onSignOut }: SidebarProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const isDesktopCollapsed = () => collapsed && window.matchMedia('(min-width: 901px)').matches;

  const showTip = (text: string) => (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    if (!isDesktopCollapsed()) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2 - 16, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  return (
    <>
      <aside className="sidebar" data-collapsed={collapsed} data-mobile-open={mobileOpen} aria-label="Main navigation" id="app-sidebar">
        <NavLink to="/" className="sidebar-brand" onClick={onNavigate} aria-label="RheumaTrack home">
          <span className="brand-mark">
            <BrandMark size={22} />
          </span>
          <span className="brand-name">RheumaTrack</span>
        </NavLink>

        <nav className="sidebar-nav">
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-group-label">{g.label}</div>
              <ul className="nav-list">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end ?? false}
                        className="nav-link"
                        onClick={() => {
                          hideTip();
                          onNavigate();
                        }}
                        onMouseEnter={showTip(item.label)}
                        onMouseLeave={hideTip}
                        onFocus={showTip(item.label)}
                        onBlur={hideTip}
                        aria-label={collapsed ? item.label : undefined}
                      >
                        <Icon aria-hidden />
                        <span className="nav-text">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="btn btn-ghost collapse-btn"
            onClick={() => {
              hideTip();
              onToggleCollapsed();
            }}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onMouseEnter={showTip('Expand sidebar')}
            onMouseLeave={hideTip}
          >
            {collapsed ? <ChevronsRight aria-hidden /> : <ChevronsLeft aria-hidden />}
            <span className="nav-text">Collapse</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost collapse-btn"
            onClick={onSignOut}
            aria-label="Sign out"
            onMouseEnter={showTip('Sign out')}
            onMouseLeave={hideTip}
          >
            <LogOut aria-hidden />
            <span className="nav-text">Sign out</span>
          </button>
          <NavLink to="/settings" className="user-chip" onClick={onNavigate} aria-label={`Account settings for ${userName || 'your account'}`}>
            <span className="avatar" aria-hidden>
              {initials}
            </span>
            <span className="user-chip-text">
              <span className="user-chip-name" style={{ display: 'block' }}>
                {userName || 'Your account'}
              </span>
              <span className="user-chip-role">{roleLabel}</span>
            </span>
          </NavLink>
        </div>
      </aside>
      {tip && (
        <div className="tooltip" role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.text}
        </div>
      )}
    </>
  );
}
