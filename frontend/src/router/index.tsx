import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Login pages are the unauthenticated entry point — keep eager.
import { SuperAdminLoginPage } from '@/pages/SuperAdminLoginPage';
import { ClientLoginPage } from '@/pages/ClientLoginPage';
// DashboardPage is the universal landing for authenticated users — keep eager so its
// h1 LCP element renders as soon as auth resolves, without a serial chunk fetch.
import { DashboardPage } from '@/pages/DashboardPage';
// All other protected pages are lazy-loaded (only downloaded on first navigation).
const AgreementPage = React.lazy(() => import('@/pages/AgreementPage').then(m => ({ default: m.AgreementPage })));
const ProjectsTasksPage = React.lazy(() => import('@/pages/ProjectsTasksPage').then(m => ({ default: m.ProjectsTasksPage })));
const BillingPage = React.lazy(() => import('@/pages/BillingPage').then(m => ({ default: m.BillingPage })));
const DocumentsPage = React.lazy(() => import('@/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const ChatPage = React.lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })));
const ComponentShowcasePage = React.lazy(() => import('@/pages/ComponentShowcasePage').then(m => ({ default: m.ComponentShowcasePage })));
const UserManagementPage = React.lazy(() => import('@/features/users/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const UserProfilePage = React.lazy(() => import('@/features/users/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const ConsentPage = React.lazy(() => import('@/features/consents/ConsentPage').then(m => ({ default: m.ConsentPage })));
const ClientListPage = React.lazy(() => import('@/features/clients/ClientListPage').then(m => ({ default: m.ClientListPage })));
const ClientDetailPage = React.lazy(() => import('@/features/clients/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const CalendarPage = React.lazy(() => import('@/pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';

/** Minimal full-screen spinner used as the Suspense fallback while a lazy chunk loads. */
const PageSpinner: React.FC = () => (
  <div className="min-h-screen bg-[#F7F9F6] flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F4F3A]" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const hasStoredToken = !!localStorage.getItem('crm_access_token');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F4F3A]"></div>
      </div>
    );
  }

  if (!isAuthenticated && !hasStoredToken) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const hasStoredToken = !!localStorage.getItem('crm_access_token');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9F6] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F4F3A]"></div>
      </div>
    );
  }

  if (!isAuthenticated && !hasStoredToken) {
    return <Navigate to="/superadmin/login" replace />;
  }

  const roleName = user?.role?.name ? String(user.role.name).toLowerCase() : '';
  if (roleName === 'client' || roleName === 'client_viewer') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
            <Route path="/client/login" element={<ClientLoginPage />} />
            <Route path="/login" element={<Navigate to="/superadmin/login" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agreement"
              element={
                <ProtectedRoute>
                  <AgreementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/consent"
              element={
                <ProtectedRoute>
                  <ConsentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <ProjectsTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <SuperAdminRoute>
                  <UserManagementPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <UserProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <SuperAdminRoute>
                  <ClientListPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="/clients/:id"
              element={
                <SuperAdminRoute>
                  <ClientDetailPage />
                </SuperAdminRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/showcase"
              element={
                <ProtectedRoute>
                  <ComponentShowcasePage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};
