import type { ReactNode } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/app/layout/ThemeToggle';

/** Two-column auth layout: form on the left, product summary on the right (hidden on mobile). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <main className="auth-panel" id="main">
        <div className="auth-card">
          <div className="row row-between">
            <div className="row">
              <span className="brand-mark">
                <BrandMark size={22} />
              </span>
              <span className="brand-name">RheumaTrack</span>
            </div>
            <ThemeToggle />
          </div>
          <div>
            <h1>{title}</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </main>
      <aside className="auth-aside" aria-label="About RheumaTrack">
        <svg className="auth-aside-art" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx="430" cy="230" r={60 + i * 48} fill="none" stroke="var(--accent)" strokeOpacity={0.16 - i * 0.02} strokeWidth="1.5" />
          ))}
          <path d="M430 230 L430 90" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
          <path d="M430 230 L540 160" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
          <path d="M430 150 A80 80 0 0 1 497 187" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="430" cy="230" r="12" fill="var(--accent)" />
        </svg>
        <div className="auth-aside-content">
          <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
            Joint mobility &amp; symptom tracking
          </span>
          <h2>See how your joints move, day to day.</h2>
          <p>
            Record pain, stiffness and discomfort, import joint-angle recordings, review observed range of motion over time, and share reports
            with a clinician you choose.
          </p>
          <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            RheumaTrack does not diagnose any condition. Observed values support conversations with your clinician.
          </p>
        </div>
      </aside>
    </div>
  );
}
