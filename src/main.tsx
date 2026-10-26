import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { createFirebaseServices } from './data/createServices';
import { resolveFirebaseMode } from './data/firebaseConfig';
import { SetupRequiredPage } from './features/setup/SetupRequiredPage';
import './design/tokens.css';
import './design/base.css';
import './design/components.css';
import './design/layout.css';

const root = createRoot(document.getElementById('root') as HTMLElement);

async function start() {
  // Automated browser tests only (see src/test-harness). Tree-shaken from normal builds.
  if (import.meta.env.VITE_TEST_HARNESS === 'memory') {
    const { createHarnessServices } = await import('./test-harness/memoryHarness');
    const services = await createHarnessServices();
    const banner = document.createElement('div');
    banner.textContent = 'Test harness — in-memory data, nothing is saved';
    banner.setAttribute('style', 'position:fixed;bottom:0;left:0;z-index:99;padding:2px 8px;font:12px sans-serif;background:#b45309;color:#fff;border-top-right-radius:6px');
    document.body.appendChild(banner);
    root.render(
      <StrictMode>
        <App services={services} />
      </StrictMode>,
    );
    return;
  }

  const mode = resolveFirebaseMode();
  if (mode.kind === 'missing') {
    root.render(
      <StrictMode>
        <ThemeProvider>
          <SetupRequiredPage missing={mode.missing} />
        </ThemeProvider>
      </StrictMode>,
    );
    return;
  }
  const services = createFirebaseServices(mode);
  root.render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  );
}

void start();
