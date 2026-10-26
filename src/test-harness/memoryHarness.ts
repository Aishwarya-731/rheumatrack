/**
 * AUTOMATED-TEST HARNESS ONLY.
 *
 * Builds in-memory services with two accounts so the browser test suite can exercise the UI
 * without Firebase. It is included only when the app is built with VITE_TEST_HARNESS=memory
 * (npm run test:e2e:memory), shows a permanent "Test harness" banner, keeps nothing after a
 * page reload and is never part of a normal build or deployment.
 */
import { addMemoryAccount, createMemoryServices, createMemoryState } from '@/data/memory/memoryServices';
import type { Services } from '@/data/services';
import { addSyntheticSampleData } from '@/features/settings/syntheticSeed';

export const HARNESS_ACCOUNTS = {
  patient: { email: 'patient@example.test', password: 'Patient123', name: 'Asha Raman' },
  clinician: { email: 'clinician@example.test', password: 'Clinician123', name: 'Dr. Priya Nair' },
  empty: { email: 'new@example.test', password: 'Newuser123', name: 'Sam Lee' },
};

export async function createHarnessServices(): Promise<Services> {
  const state = createMemoryState();
  addMemoryAccount(state, { uid: 'patient-1', email: HARNESS_ACCOUNTS.patient.email, emailVerified: true, displayName: HARNESS_ACCOUNTS.patient.name }, HARNESS_ACCOUNTS.patient.password);
  addMemoryAccount(state, { uid: 'clinician-1', email: HARNESS_ACCOUNTS.clinician.email, emailVerified: true, displayName: HARNESS_ACCOUNTS.clinician.name }, HARNESS_ACCOUNTS.clinician.password, 'clinician');
  addMemoryAccount(state, { uid: 'empty-1', email: HARNESS_ACCOUNTS.empty.email, emailVerified: false, displayName: HARNESS_ACCOUNTS.empty.name }, HARNESS_ACCOUNTS.empty.password);
  const services = createMemoryServices(state);
  // Seed the patient's synthetic records while signed in as them, then sign out.
  services.signInAs('patient-1');
  await addSyntheticSampleData(services.data, 'patient-1');
  await services.auth.signOut();
  return services;
}
