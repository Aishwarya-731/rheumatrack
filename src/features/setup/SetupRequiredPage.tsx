import { Settings2 } from 'lucide-react';
import { ThemeToggle } from '@/app/layout/ThemeToggle';
import { BrandMark } from '@/components/BrandMark';

/** Shown when no Firebase configuration is present. No data features run in this state. */
export function SetupRequiredPage({ missing }: { missing: string[] }) {
  return (
    <main id="main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 640, width: '100%' }}>
        <div className="row row-between" style={{ marginBottom: 20 }}>
          <div className="row">
            <span className="brand-mark">
              <BrandMark size={22} />
            </span>
            <span className="brand-name">RheumaTrack</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <Settings2 aria-hidden style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>Setup required</h1>
        </div>
        <p className="muted">RheumaTrack needs a Firebase backend before anyone can sign in. No account or record features are available until then.</p>
        <h2 style={{ fontSize: 'var(--fs-md)', marginTop: 20 }}>Option 1 — run everything locally (no Firebase account needed)</h2>
        <pre className="card" style={{ marginTop: 8, overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>
          npm run dev:local{'\n'}npm run seed   # in a second terminal, optional synthetic sample data
        </pre>
        <h2 style={{ fontSize: 'var(--fs-md)', marginTop: 20 }}>Option 2 — connect a Firebase project</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in the values from your Firebase project settings. Missing:
        </p>
        <ul>
          {missing.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
          Full instructions are in README.md, section “Firebase setup”.
        </p>
      </div>
    </main>
  );
}
