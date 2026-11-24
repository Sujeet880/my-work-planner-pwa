import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute, OwnerRoute, ClientPortalRoute, LoadingScreen } from './components/auth/ProtectedRoute';
import { SignInPage } from './features/auth/SignInPage';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MyTasksPage } from './features/tasks/MyTasksPage';
import { TaskDetailsPage } from './features/tasks/TaskDetailsPage';
import { TimeTrackerPage } from './features/time-tracker/TimeTrackerPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { ProjectDetailsPage } from './features/projects/ProjectDetailsPage';
import { OwnerClientInboxPage } from './features/inbox/OwnerClientInboxPage';
import { SharedProjectsPage } from './features/portal/SharedProjectsPage';
import { ClientProjectWorkspacePage } from './features/portal/ClientProjectWorkspacePage';
import { ClientInboxPage } from './features/portal/ClientInboxPage';
import { AcceptInvitationPage } from './features/portal/AcceptInvitationPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { GoogleCalendarPage } from './features/settings/GoogleCalendarPage';
import { NativeTimerConnectPage } from './features/settings/NativeTimerConnectPage';

function LoginRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/sign-in', search: location.search }} replace />;
}

function RootRedirect() {
  const { isAuthenticated, isOwner, isClient, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen label="Loading My Work Planner..." sublabel="Initializing your workspace" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  if (isClient && !isOwner) {
    return <Navigate to="/portal" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function WorkspaceRoutes() {
  return (
    <OwnerRoute>
      <AppShell>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<MyTasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
          <Route path="/time-tracker" element={<TimeTrackerPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
          <Route path="/inbox" element={<OwnerClientInboxPage />} />
          <Route path="/client-inbox" element={<Navigate to="/inbox" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/google-calendar" element={<GoogleCalendarPage />} />
          <Route path="/settings/integrations/google-calendar" element={<GoogleCalendarPage />} />
          <Route path="/calendar" element={<Navigate to="/settings/integrations/google-calendar" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
    </OwnerRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/invite/:token" element={<AcceptInvitationPage />} />
            <Route path="/settings/native-timer/connect" element={<NativeTimerConnectPage />} />

            {/* Client Portal Routes (Protected by ClientPortalRoute) */}
            <Route
              path="/portal"
              element={
                <ClientPortalRoute>
                  <SharedProjectsPage />
                </ClientPortalRoute>
              }
            />
            <Route
              path="/portal/shared-with-me"
              element={<Navigate to="/portal" replace />}
            />
            <Route
              path="/portal/projects/:projectId"
              element={
                <ClientPortalRoute>
                  <ClientProjectWorkspacePage />
                </ClientPortalRoute>
              }
            />
            <Route
              path="/portal/inbox"
              element={
                <ClientPortalRoute>
                  <ClientInboxPage />
                </ClientPortalRoute>
              }
            />

            {/* Owner Workspace Routes (Protected by OwnerRoute inside WorkspaceRoutes) */}
            <Route path="/*" element={<WorkspaceRoutes />} />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
