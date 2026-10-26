import { expect, type Page, type TestInfo } from '@playwright/test';

/** Credentials for each project: the seeded emulator demo users or the in-memory harness users. */
export function accounts(info: TestInfo) {
  return info.project.name === 'harness'
    ? { patient: { email: 'patient@example.test', password: 'Patient123' }, clinician: { email: 'clinician@example.test', password: 'Clinician123' } }
    : { patient: { email: 'patient@rheumatrack.test', password: 'Patient123' }, clinician: { email: 'clinician@rheumatrack.test', password: 'Clinician123' } };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAsPatient(page: Page, info: TestInfo) {
  const { patient } = accounts(info);
  await signIn(page, patient.email, patient.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

/** Client-side navigation through the sidebar (keeps in-memory harness state). */
export async function nav(page: Page, label: string) {
  await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
}
