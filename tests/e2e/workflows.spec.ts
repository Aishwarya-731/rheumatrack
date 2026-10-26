import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { accounts, nav, signIn, signInAsPatient } from './helpers';

const VALID = 'matlab/samples/synthetic_elbow_right_flexion.csv';
const INVALID = 'matlab/samples/invalid_values.csv';

test.describe('RheumaTrack core workflows', () => {
  test('1. signing in (and rejecting a wrong password)', async ({ page }, info) => {
    const { patient } = accounts(info);
    await signIn(page, patient.email, 'wrong-password');
    await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
    await page.getByLabel('Password').fill(patient.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('2. selecting a joint and side; the 3D viewer renders and follows the selection', async ({ page }, info) => {
    await signInAsPatient(page, info);
    await nav(page, 'Joints & ROM');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.getByTestId('diagram-elbow-left').click();
    await expect(page.getByRole('link', { name: /Left elbow details/ })).toBeVisible();
    await expect(page.getByTestId('joint-select')).toHaveValue('elbow');
    await expect(page.getByRole('button', { name: 'Full body' })).toBeVisible(); // zoomed in
    await page.getByRole('group', { name: 'Side' }).getByRole('button', { name: 'Right' }).click();
    await expect(page.getByRole('link', { name: /Right elbow details/ })).toBeVisible();
    await expect(page.getByTestId('illustrative-angle')).toContainText('Animation angle');
  });

  test('3–5. importing valid data, rejecting invalid data, reviewing ROM', async ({ page }, info) => {
    await signInAsPatient(page, info);
    await nav(page, 'Import movement');
    await page.getByTestId('movement-file-input').setInputFiles(INVALID);
    await expect(page.getByRole('heading', { name: /File rejected/ })).toBeVisible();
    await expect(page.getByTestId('validation-errors')).toContainText('is not a number');
    await page.getByRole('button', { name: 'Choose another file' }).click();

    await page.getByTestId('movement-file-input').setInputFiles(VALID);
    await expect(page.getByText(/Valid file — synthetic_elbow_right_flexion.csv/)).toBeVisible();
    const rom = await page.getByTestId('import-metrics').locator('dt:has-text("Observed ROM") + dd').innerText();
    await page.getByTestId('source-select').selectOption('simulation');
    await page.getByRole('button', { name: 'Save session' }).click();
    await expect(page.getByRole('heading', { name: 'Right elbow flexion' })).toBeVisible();
    await expect(page.getByTestId('session-metrics').locator('dt:has-text("Observed ROM") + dd')).toHaveText(rom);
    await expect(page.getByText('Simulation-generated data').first()).toBeVisible();
    await expect(page.getByText('Synthetic sample data').first()).toBeVisible();
    await page.getByRole('button', { name: 'Play recording' }).click();
    await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  });

  test('6. saving a symptom assessment', async ({ page }, info) => {
    await signInAsPatient(page, info);
    await nav(page, 'Symptom check-in');
    await page.getByRole('combobox', { name: 'Joint' }).selectOption('wrist');
    await page.getByLabel('Pain', { exact: true }).fill('4');
    await page.getByLabel('Stiffness', { exact: true }).fill('6');
    await page.getByLabel(/Duration of stiffness/).fill('25');
    await page.getByLabel('Notes (optional)').fill('E2E check-in');
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByRole('heading', { name: /Check-in · Right wrist/ })).toBeVisible();
    await expect(page.getByText('E2E check-in')).toBeVisible();
  });

  test('7. viewing history and trends', async ({ page }, info) => {
    await signInAsPatient(page, info);
    await nav(page, 'History');
    await expect(page.getByTestId('sessions-table')).toBeVisible();
    await page.getByRole('combobox', { name: 'Joint' }).selectOption('knee');
    await expect(page.getByTestId('sessions-table').locator('tbody tr').first()).toContainText('knee');
    await page.getByRole('tab', { name: /Symptom check-ins/ }).click();
    await expect(page.getByTestId('assessments-table')).toBeVisible();
    await nav(page, 'Trends');
    await expect(page.getByTestId('rom-trend-chart')).toBeVisible();
    await expect(page.getByText(/Symptom ↔ observed ROM association/)).toBeVisible();
  });

  test('8. switching themes (persisted across reloads)', async ({ page }, info) => {
    await signInAsPatient(page, info);
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.getByTestId('theme-toggle').click();
    const after = before === 'dark' ? 'light' : 'dark';
    await expect(html).toHaveAttribute('data-theme', after);
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', after);
  });

  test('9. collapsing and expanding the sidebar', async ({ page }, info) => {
    await signInAsPatient(page, info);
    const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await expect(sidebar.getByRole('link', { name: 'History' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('10. exporting and deleting records', async ({ page }, info) => {
    await signInAsPatient(page, info);
    await nav(page, 'Reports & export');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sessions CSV' }).click()]);
    const csv = readFileSync((await download.path()) as string, 'utf8');
    expect(csv.split('\n')[0]).toContain('observedRomDeg');
    expect(csv).toContain('Simulation-generated data');

    await nav(page, 'History');
    const rows = page.getByTestId('sessions-table').locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    await rows.first().getByRole('button', { name: /Delete session/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(rows).toHaveCount(count - 1);
  });

  test('clinician sees only shared patients, read-only', async ({ page }, info) => {
    const { clinician, patient } = accounts(info);
    test.skip(info.project.name === 'harness', 'The harness has no pre-accepted share; covered by unit tests.');
    await signIn(page, clinician.email, clinician.password);
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await page.getByRole('link', { name: /Asha Raman/ }).click();
    await expect(page.getByText('Read-only')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Check-in' })).toHaveCount(0);
    expect(patient.email).toBeTruthy();
  });
});
