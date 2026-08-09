import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SuperAdminLoginPage } from '@/pages/SuperAdminLoginPage';
import { ClientLoginPage } from '@/pages/ClientLoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AgreementPage } from '@/pages/AgreementPage';
import { ProjectsTasksPage } from '@/pages/ProjectsTasksPage';
import { BillingPage } from '@/pages/BillingPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { ChatPage } from '@/pages/ChatPage';
import { WhatsAppPage } from '@/pages/WhatsAppPage';
import { ComponentShowcasePage } from '@/pages/ComponentShowcasePage';
import { UserManagementPage } from '@/features/users/UserManagementPage';
import { UserProfilePage } from '@/features/users/UserProfilePage';
import { ClientListPage } from '@/features/clients/ClientListPage';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
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
            path="/whatsapp"
            element={
              <SuperAdminRoute>
                <WhatsAppPage />
              </SuperAdminRoute>
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
      </AuthProvider>
    </BrowserRouter>
  );
};
