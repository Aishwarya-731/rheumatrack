import { render } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';
import { AppProviders, AppRoutes } from '@/app/App';
import { addMemoryAccount, createMemoryServices, createMemoryState } from '@/data/memory/memoryServices';

export const PATIENT = { uid: 'p1', email: 'pat@example.test', emailVerified: true, displayName: 'Pat Example' };
export const CLINICIAN = { uid: 'c1', email: 'doc@example.test', emailVerified: true, displayName: 'Dr Example' };
export const OTHER = { uid: 'p2', email: 'other@example.test', emailVerified: true, displayName: 'Other Person' };

export function setupServices() {
  const state = createMemoryState();
  addMemoryAccount(state, PATIENT, 'Password1');
  addMemoryAccount(state, CLINICIAN, 'Password1', 'clinician');
  addMemoryAccount(state, OTHER, 'Password1');
  return createMemoryServices(state);
}

export function renderApp(path: string, services = setupServices(), signedInAs: string | null = PATIENT.uid) {
  if (signedInAs) services.signInAs(signedInAs);
  const utils = render(
    <AppProviders services={services}>
      <MemoryRouter initialEntries={[path]}>
        <Suspense fallback={<div>Loading…</div>}>
          <AppRoutes />
        </Suspense>
      </MemoryRouter>
    </AppProviders>,
  );
  return { ...utils, services };
}

export function csvFile(name: string, rows: string[]): File {
  const text = ['timestamp,joint,side,movement,angleDeg', ...rows].join('\n') + '\n';
  return new File([text], name, { type: 'text/csv' });
}

export function regularCsvRows(n: number, joint = 'knee', side = 'left', movement = 'flexion', stepMs = 20): string[] {
  const base = Date.UTC(2026, 9, 25, 9, 0, 0);
  return Array.from({ length: n }, (_, i) => `${new Date(base + i * stepMs).toISOString()},${joint},${side},${movement},${(50 - 50 * Math.cos((2 * Math.PI * i) / 50)).toFixed(2)}`);
}
