import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { SignInPage } from './features/auth/SignInPage';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MyTasksPage } from './features/tasks/MyTasksPage';
import { TaskDetailsPage } from './features/tasks/TaskDetailsPage';
import { TimeTrackerPage } from './features/time-tracker/TimeTrackerPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { GoogleCalendarPage } from './features/settings/GoogleCalendarPage';

function WorkspaceRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<MyTasksPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
        <Route path="/time-tracker" element={<TimeTrackerPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/google-calendar" element={<GoogleCalendarPage />} />
        <Route path="/calendar" element={<Navigate to="/settings/google-calendar" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <WorkspaceRoutes />
                </ProtectedRoute>
              }
            />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
