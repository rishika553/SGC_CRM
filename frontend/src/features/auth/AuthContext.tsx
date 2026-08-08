import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { api } from '@/lib/axios';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, portal?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('crm_access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const currentToken = localStorage.getItem('crm_access_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get('/users/me');
      if (response.data.success) {
        setUser(response.data.data);
      }
    } catch (error) {
      localStorage.removeItem('crm_access_token');
      localStorage.removeItem('crm_refresh_token');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen to Supabase auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.access_token) {
        localStorage.setItem('crm_access_token', session.access_token);
        setToken(session.access_token);
        await refreshProfile();
      }
    });

    refreshProfile();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const login = async (emailInput: string, password: string, portal?: string) => {
    setIsLoading(true);
    try {
      let email = emailInput.trim();
      if (!email.includes('@')) {
        email = `${email}@sgccrm.com`;
      }
      // 1. Authenticate directly via Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.session) {
        throw new Error(error?.message || 'Authentication failed. Please check your credentials.');
      }

      const accessToken = data.session.access_token;
      localStorage.setItem('crm_access_token', accessToken);
      if (data.session.refresh_token) {
        localStorage.setItem('crm_refresh_token', data.session.refresh_token);
      }
      setToken(accessToken);

      // 2. Fetch DB-verified user profile from FastAPI backend
      const response = await api.get('/users/me');
      if (!response.data?.success || !response.data?.data) {
        await supabase.auth.signOut();
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setToken(null);
        setUser(null);
        throw new Error('User profile record not found in database.');
      }

      const userData: User = response.data.data;
      const rawRole = userData.role?.name ? String(userData.role.name).toLowerCase() : '';
      const isClientUser = rawRole === 'client' || rawRole === 'client_viewer';
      const isAdminUser = rawRole === 'super_admin' || rawRole === 'admin';

      // 3. Enforce Portal Protection based on DB-verified role
      if (portal === 'superadmin' && !isAdminUser) {
        await supabase.auth.signOut();
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setToken(null);
        setUser(null);
        throw new Error('Access Denied: Client accounts cannot access the Super Admin Portal. Please use the Client Login page.');
      }

      if (portal === 'client' && !isClientUser) {
        await supabase.auth.signOut();
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setToken(null);
        setUser(null);
        throw new Error('Access Denied: Corporate Admin accounts cannot access the Client Portal. Please use the Super Admin Login page.');
      }

      setUser(userData);
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if Supabase offline
    }
    localStorage.removeItem('crm_access_token');
    localStorage.removeItem('crm_refresh_token');
    setToken(null);
    setUser(null);
    window.location.href = '/superadmin/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
