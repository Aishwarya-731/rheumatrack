import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { csvFile, CLINICIAN, PATIENT, regularCsvRows, renderApp, setupServices } from '@/test/renderApp';
import { makeAssessment, makeSession } from '@/test/factories';
import { THEME_STORAGE_KEY } from './providers/ThemeProvider';
import { SIDEBAR_STORAGE_KEY } from './layout/AppLayout';

// WebGL is unavailable in jsdom; the 3D components are exercised in the browser test suite.
vi.mock('@/features/viewer3d/SamplePlayer3D', () => ({ default: () => <div data-testid="sample-player-stub" /> }));
vi.mock('@/features/viewer3d/BodyViewer3D', () => ({ default: () => <div data-testid="body-viewer-stub" /> }));

describe('authentication-protected routes', () => {
  it('redirects a signed-out visitor to the sign-in page', async () => {
    renderApp('/history', setupServices(), null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in with valid credentials and shows the dashboard', async () => {
    const user = userEvent.setup();
    renderApp('/login', setupServices(), null);
    await user.type(await screen.findByLabelText('Email'), PATIENT.email);
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows a clear error for wrong credentials', async () => {
    const user = userEvent.setup();
    renderApp('/login', setupServices(), null);
    await user.type(await screen.findByLabelText('Email'), PATIENT.email);
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument();
  });

  it('keeps patients out of clinician pages and clinicians out of patient pages', async () => {
    const a = renderApp('/clinician');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    a.unmount();
    renderApp('/', setupServices(), CLINICIAN.uid);
    expect(await screen.findByRole('heading', { name: 'Patients' })).toBeInTheDocument();
  });

  it('a clinician without a share cannot open a patient record by URL', async () => {
    const services = setupServices();
    services.state.sessions.set(PATIENT.uid, [makeSession({ id: 'secret', ownerUid: PATIENT.uid })]);
    renderApp(`/clinician/patients/${PATIENT.uid}/history`, services, CLINICIAN.uid);
    expect((await screen.findAllByText(/You do not have permission/)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('sessions-table')).not.toBeInTheDocument();
  });

  it('a clinician with an accepted share sees the patient read-only', async () => {
    const services = setupServices();
    services.state.sessions.set(PATIENT.uid, [makeSession({ id: 's-shared', ownerUid: PATIENT.uid })]);
    services.state.shares.push({ id: `${PATIENT.uid}_${CLINICIAN.uid}`, patientUid: PATIENT.uid, clinicianUid: CLINICIAN.uid, clinicianEmail: CLINICIAN.email, patientName: 'Pat', inviteId: 'i1', createdAt: 0 });
    renderApp(`/clinician/patients/${PATIENT.uid}/history`, services, CLINICIAN.uid);
    const table = await screen.findByTestId('sessions-table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Delete session/ })).not.toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });
});

describe('theme', () => {
  it('toggles the theme and persists the choice', async () => {
    document.documentElement.dataset.theme = 'dark';
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await user.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('sidebar', () => {
  it('collapses to icons with accessible labels and remembers the state', async () => {
    const user = userEvent.setup();
    const first = renderApp('/');
    await screen.findByRole('heading', { name: 'Dashboard' });
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' });
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    expect(within(sidebar).getByRole('link', { name: 'History' })).toBeInTheDocument();
    first.unmount();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByRole('complementary', { name: 'Main navigation' })).toHaveAttribute('data-collapsed', 'true');
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
  });
});

describe('joint selection synchronisation', () => {
  it('body diagram, joint dropdown, side toggle and movement options stay in sync', async () => {
    const user = userEvent.setup();
    renderApp('/joints');
    await screen.findByRole('heading', { name: /Joints & range of motion/ });
    await user.click(screen.getByTestId('diagram-knee-left'));
    const jointSelect = screen.getByTestId('joint-select') as HTMLSelectElement;
    expect(jointSelect.value).toBe('knee');
    expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('diagram-knee-left')).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(jointSelect, 'ankle');
    const movement = screen.getByTestId('movement-select') as HTMLSelectElement;
    expect(movement.value).toBe('dorsiflexion');
    expect([...movement.options].map((o) => o.value)).toEqual(['dorsiflexion', 'plantarflexion']);
    expect(screen.getByTestId('diagram-ankle-left')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Right' }));
    expect(screen.getByTestId('diagram-ankle-right')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Right ankle details/ })).toBeInTheDocument();
  });

  it('the joint detail URL drives the selection', async () => {
    renderApp('/joints/wrist/left');
    expect(await screen.findByRole('heading', { name: 'Left wrist' })).toBeInTheDocument();
    await waitFor(() => expect((screen.getByTestId('joint-select') as HTMLSelectElement).value).toBe('wrist'));
    expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('symptom assessment', () => {
  it('validates input and saves a new timestamped record without overwriting earlier ones', async () => {
    const services = setupServices();
    services.state.assessments.set(PATIENT.uid, [makeAssessment({ id: 'old', ownerUid: PATIENT.uid, pain: 9 })]);
    const user = userEvent.setup();
    renderApp('/symptoms/new', services);
    await screen.findByRole('heading', { name: 'Symptom check-in' });
    const duration = screen.getByLabelText(/Duration of stiffness/);
    await user.type(duration, 'abc');
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    expect(await screen.findByText(/whole minutes/)).toBeInTheDocument();
    expect(services.state.assessments.get(PATIENT.uid)).toHaveLength(1);

    await user.clear(duration);
    await user.type(duration, '45');
    fireEvent.change(screen.getByLabelText('Pain'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Stiffness'), { target: { value: '7' } });
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    expect(await screen.findByRole('heading', { name: /Check-in ·/ })).toBeInTheDocument();
    const saved = services.state.assessments.get(PATIENT.uid) ?? [];
    expect(saved).toHaveLength(2);
    const created = saved.find((a) => a.id !== 'old');
    expect(created).toMatchObject({ pain: 6, stiffness: 7, discomfort: 0, durationMinutes: 45 });
    expect(saved.find((a) => a.id === 'old')?.pain).toBe(9);
  });
});

describe('movement import', () => {
  it('imports a valid CSV, shows calculated ROM and saves it with its source', async () => {
    const services = setupServices();
    const user = userEvent.setup();
    renderApp('/movement/import', services);
    await screen.findByRole('heading', { name: 'Import movement data' });
    await user.upload(screen.getByTestId('movement-file-input'), csvFile('knee.csv', regularCsvRows(120)));
    expect(await screen.findByText(/Valid file — knee.csv/)).toBeInTheDocument();
    const metrics = screen.getByTestId('import-metrics');
    expect(within(metrics).getByText('Observed ROM').nextElementSibling).toHaveTextContent('100.0°');
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    expect(await screen.findByText('Select where this recording came from.')).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('source-select'), 'imported');
    await user.click(screen.getByRole('button', { name: 'Save session' }));
    await screen.findByRole('heading', { name: 'Left knee flexion' });
    const s = services.state.sessions.get(PATIENT.uid)?.[0];
    expect(s).toMatchObject({ joint: 'knee', side: 'left', movement: 'flexion', source: 'imported', isSynthetic: false, calibrationStatus: 'not-calibrated' });
    expect(s?.metrics.romDeg).toBe(100);
    expect(services.state.samples.get(s!.id)).toHaveLength(120);
  });

  it('rejects an invalid file with row-level errors and saves nothing', async () => {
    const services = setupServices();
    const user = userEvent.setup();
    renderApp('/movement/import', services);
    await screen.findByRole('heading', { name: 'Import movement data' });
    const rows = regularCsvRows(30);
    rows[4] = rows[3] as string;
    rows[9] = (rows[9] as string).replace(/,[^,]*$/, ',abc');
    await user.upload(screen.getByTestId('movement-file-input'), csvFile('bad.csv', rows));
    const table = await screen.findByTestId('validation-errors');
    expect(within(table).getByText(/Angle "abc" is not a number/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /File rejected/ })).toBeInTheDocument();
    expect(services.state.sessions.get(PATIENT.uid) ?? []).toHaveLength(0);
  });
});

describe('history', () => {
  it('filters records and deletes after confirmation', async () => {
    const services = setupServices();
    services.state.sessions.set(PATIENT.uid, [
      makeSession({ id: 'k', ownerUid: PATIENT.uid, joint: 'knee', side: 'left' }),
      makeSession({ id: 'h', ownerUid: PATIENT.uid, joint: 'hip', side: 'right' }),
    ]);
    const user = userEvent.setup();
    renderApp('/history', services);
    const table = await screen.findByTestId('sessions-table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Joint' }), 'hip');
    expect(within(screen.getByTestId('sessions-table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Right hip')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Delete session/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(services.state.sessions.get(PATIENT.uid)?.map((s) => s.id)).toEqual(['k']));
  });

  it('shows the empty state when nothing is recorded', async () => {
    renderApp('/history');
    expect(await screen.findByText('No movement sessions yet')).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  it('shows an empty state with no invented numbers when there are no records', async () => {
    renderApp('/');
    expect(await screen.findByText('No records yet')).toBeInTheDocument();
    expect(screen.queryByText('Latest observed ROM')).not.toBeInTheDocument();
  });

  it('derives figures from the user’s records only', async () => {
    const services = setupServices();
    const now = Date.now();
    services.state.sessions.set(PATIENT.uid, [makeSession({ ownerUid: PATIENT.uid, startedAt: now - 3600_000, metrics: { ...makeSession().metrics, romDeg: 77.25 } })]);
    services.state.sessions.set('p2', [makeSession({ ownerUid: 'p2', startedAt: now - 1000, metrics: { ...makeSession().metrics, romDeg: 12 } })]);
    renderApp('/', services);
    const card = await screen.findByRole('region', { name: 'Latest observed ROM' });
    expect(within(card).getByText('77.3°')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Movement sessions' })).getByText('1')).toBeInTheDocument();
  });
});

describe('sharing workflow', () => {
  it('patient invites, clinician accepts, patient revokes', async () => {
    const services = setupServices();
    const user = userEvent.setup();
    const view = renderApp('/sharing', services);
    await screen.findByRole('heading', { name: 'Sharing' });
    await user.type(screen.getByLabelText('Clinician’s email'), CLINICIAN.email);
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByText(/Confirm that you consent/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect(await screen.findByText('Waiting for clinician')).toBeInTheDocument();
    view.unmount();

    const clin = renderApp('/clinician', services, CLINICIAN.uid);
    await user.click(await screen.findByRole('button', { name: 'Accept' }));
    expect(await screen.findByRole('link', { name: PATIENT.displayName })).toBeInTheDocument();
    expect(services.state.shares).toHaveLength(1);
    clin.unmount();

    renderApp('/sharing', services, PATIENT.uid);
    await user.click(await screen.findByRole('button', { name: /Revoke access/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(services.state.shares).toHaveLength(0));
  });
});

describe('settings', () => {
  it('removes only synthetic records', async () => {
    const services = setupServices();
    services.state.sessions.set(PATIENT.uid, [makeSession({ id: 'real', ownerUid: PATIENT.uid }), makeSession({ id: 'syn', ownerUid: PATIENT.uid, source: 'simulation', isSynthetic: true })]);
    const user = userEvent.setup();
    renderApp('/settings', services);
    await user.click(await screen.findByRole('button', { name: /Remove all synthetic data/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove synthetic data' }));
    await waitFor(() => expect(services.state.sessions.get(PATIENT.uid)?.map((s) => s.id)).toEqual(['real']));
  });

  it('saves reminder settings and validates days', async () => {
    const services = setupServices();
    const user = userEvent.setup();
    renderApp('/settings', services);
    await screen.findByRole('heading', { name: 'Settings' });
    await user.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) await user.click(screen.getByRole('button', { name: d }));
    await user.click(screen.getByRole('button', { name: /Save reminders/ }));
    expect(await screen.findByText('Select at least one day.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: /Save reminders/ }));
    await waitFor(() => expect(services.state.profiles.get(PATIENT.uid)?.reminders).toMatchObject({ enabled: true, days: [3] }));
  });
});

describe('session detail', () => {
  it('shows metrics, playback controls and exports', async () => {
    const services = setupServices();
    const user = userEvent.setup();
    services.signInAs(PATIENT.uid);
    const samples = Array.from({ length: 50 }, (_, i) => ({ t: 1_000_000 + i * 20, angleDeg: i }));
    const { computeMetrics } = await import('@/domain/metrics');
    await act(async () => {
      await services.data.createSession(
        PATIENT.uid,
        { joint: 'elbow', side: 'right', movement: 'flexion', source: 'imported', isSynthetic: false, sourceFileName: 'e.csv', sourceFormat: 'csv', metrics: computeMetrics(samples), calibrationId: null, calibrationStatus: 'not-calibrated', notes: '' },
        samples,
      );
    });
    const id = services.state.sessions.get(PATIENT.uid)?.[0]?.id as string;
    renderApp(`/sessions/${id}`, services);
    expect(await screen.findByRole('heading', { name: 'Right elbow flexion' })).toBeInTheDocument();
    const m = screen.getByTestId('session-metrics');
    expect(within(m).getByText('Observed ROM').nextElementSibling).toHaveTextContent('49.0°');
    expect(within(m).getByText('Mean angle').nextElementSibling).toHaveTextContent('24.5°');
    await screen.findByRole('button', { name: 'Play recording' });
    await user.click(screen.getByRole('button', { name: /How is this calculated/ }));
    expect(await screen.findByRole('dialog', { name: 'How these values are calculated' })).toBeInTheDocument();
  });
});
