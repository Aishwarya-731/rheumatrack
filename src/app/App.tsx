import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router';
import { FullPageLoader, LoadingCard } from '@/components/ui/Feedback';
import type { Services } from '@/data/services';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { AppLayout } from './layout/AppLayout';
import { AuthProvider } from './providers/AuthProvider';
import { SelectionProvider } from './providers/SelectionProvider';
import { ServicesProvider } from './providers/ServicesProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { ToastProvider } from './providers/ToastProvider';
import { GuestRoute, ProtectedRoute, RoleRoute } from './routes/guards';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const JointsPage = lazy(() => import('@/features/joints/JointsPage').then((m) => ({ default: m.JointsPage })));
const JointDetailPage = lazy(() => import('@/features/joints/JointDetailPage').then((m) => ({ default: m.JointDetailPage })));
const NewSymptomPage = lazy(() => import('@/features/symptoms/SymptomPages').then((m) => ({ default: m.NewSymptomPage })));
const SymptomDetailPage = lazy(() => import('@/features/symptoms/SymptomPages').then((m) => ({ default: m.SymptomDetailPage })));
const ImportPage = lazy(() => import('@/features/movement/ImportPage').then((m) => ({ default: m.ImportPage })));
const SessionDetailPage = lazy(() => import('@/features/movement/SessionDetailPage').then((m) => ({ default: m.SessionDetailPage })));
const CalibrationPage = lazy(() => import('@/features/calibration/CalibrationPage').then((m) => ({ default: m.CalibrationPage })));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ClinicianReportPage = lazy(() => import('@/features/reports/ReportViews').then((m) => ({ default: m.ClinicianReportPage })));
const SessionReportPage = lazy(() => import('@/features/reports/ReportViews').then((m) => ({ default: m.SessionReportPage })));
const SharingPage = lazy(() => import('@/features/sharing/SharingPage').then((m) => ({ default: m.SharingPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ClinicianHomePage = lazy(() => import('@/features/clinician/ClinicianPages').then((m) => ({ default: m.ClinicianHomePage })));
const ClinicianPatientLayout = lazy(() => import('@/features/clinician/ClinicianPages').then((m) => ({ default: m.ClinicianPatientLayout })));

function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="page" aria-busy="true">
          <LoadingCard lines={6} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const S = (el: ReactNode) => <PageSuspense>{el}</PageSuspense>;

export function NotFoundPage() {
  return (
    <div className="page">
      <div className="card" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="muted" style={{ margin: '8px 0 16px' }}>
          The page you are looking for does not exist.
        </p>
        <Link to="/" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

/** Routes shared by the patient's own area and the clinician's read-only patient view. */
function recordRoutes() {
  return (
    <>
      <Route path="joints" element={S(<JointsPage />)} />
      <Route path="joints/:joint/:side" element={S(<JointDetailPage />)} />
      <Route path="sessions/:id" element={S(<SessionDetailPage />)} />
      <Route path="symptoms/:id" element={S(<SymptomDetailPage />)} />
      <Route path="history" element={S(<HistoryPage />)} />
      <Route path="analytics" element={S(<AnalyticsPage />)} />
      <Route path="reports" element={S(<ReportsPage />)} />
      <Route path="reports/clinician" element={S(<ClinicianReportPage />)} />
      <Route path="reports/session/:id" element={S(<SessionReportPage />)} />
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignUpPage /></GuestRoute>} />
      <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/settings" element={S(<SettingsPage />)} />
        <Route path="/clinician" element={<RoleRoute role="clinician">{S(<ClinicianHomePage />)}</RoleRoute>} />
        <Route path="/clinician/patients/:patientUid" element={<RoleRoute role="clinician">{S(<ClinicianPatientLayout />)}</RoleRoute>}>
          <Route index element={S(<DashboardPage />)} />
          {recordRoutes()}
        </Route>
        <Route
          path="/"
          element={
            <RoleRoute role="patient">
              <Outlet />
            </RoleRoute>
          }
        >
          <Route index element={S(<DashboardPage />)} />
          <Route path="symptoms/new" element={S(<NewSymptomPage />)} />
          <Route path="movement/import" element={S(<ImportPage />)} />
          <Route path="calibration" element={S(<CalibrationPage />)} />
          <Route path="sharing" element={S(<SharingPage />)} />
          {recordRoutes()}
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function AppProviders({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <ThemeProvider>
      <ServicesProvider services={services}>
        <ToastProvider>
          <AuthProvider>
            <SelectionProvider>{children}</SelectionProvider>
          </AuthProvider>
        </ToastProvider>
      </ServicesProvider>
    </ThemeProvider>
  );
}

export function App({ services }: { services: Services }) {
  return (
    <AppProviders services={services}>
      <BrowserRouter>
        <Suspense fallback={<FullPageLoader />}>
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </AppProviders>
  );
}
