import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SuperAdminLoginPage } from '@/pages/SuperAdminLoginPage';
import { ClientLoginPage } from '@/pages/ClientLoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';

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

const PageSpinner: React.FC = () => (
  <div className="min-h-screen bg-[#F7F9F6] flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F4F3A]" />
  </div>
);

/**
 * Reusable auth guard — applied to every protected route.
 *
 * Security model:
 * - Never trusts localStorage alone. The AuthProvider validates the Supabase
 *   session on mount via supabase.auth.getSession(). Until that validation
 *   completes, `isLoading` is true and this guard shows a spinner.
 * - After loading: if `isAuthenticated` is false (no valid Supabase session
 *   AND no valid backend profile), redirect to login immediately.
 * - This prevents: direct URL access, bookmarks, back-button cache, stale tokens.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
};

/**
 * SuperAdmin-only guard: extends ProtectedRoute with a role check.
 * Client-role users hitting admin routes are bounced to the dashboard.
 */
const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <PageSpinner />;
  }

  if (!isAuthenticated) {
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
            {/* Public routes — no auth guard */}
            <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
            <Route path="/client/login" element={<ClientLoginPage />} />
            <Route path="/login" element={<Navigate to="/superadmin/login" replace />} />

            {/* Protected routes — require valid Supabase session */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/agreement" element={<ProtectedRoute><AgreementPage /></ProtectedRoute>} />
            <Route path="/consent" element={<ProtectedRoute><ConsentPage /></ProtectedRoute>} />
            <Route path="/agendas" element={<ProtectedRoute><ProjectsTasksPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/showcase" element={<ProtectedRoute><ComponentShowcasePage /></ProtectedRoute>} />

            {/* SuperAdmin-only routes — require valid session + admin role */}
            <Route path="/users" element={<SuperAdminRoute><UserManagementPage /></SuperAdminRoute>} />
            <Route path="/clients" element={<SuperAdminRoute><ClientListPage /></SuperAdminRoute>} />
            <Route path="/clients/:id" element={<SuperAdminRoute><ClientDetailPage /></SuperAdminRoute>} />

            {/* Catch-all */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};
