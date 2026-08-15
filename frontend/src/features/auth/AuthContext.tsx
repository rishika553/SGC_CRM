import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, ApiResponse } from '@/types';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { unsubscribeFromPush } from '@/lib/push';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, portal?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('crm_access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const refreshInFlight = useRef<Promise<User | null> | null>(null);

  // Single source of truth for the authenticated user profile.
  // Concurrent callers share the same in-flight request so /users/me is
  // only ever sent once at a time (e.g. INITIAL_SESSION + TOKEN_REFRESHED racing).
  const refreshProfile = useCallback((): Promise<User | null> => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const currentToken = localStorage.getItem('crm_access_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return Promise.resolve(null);
    }

    refreshInFlight.current = (async () => {
      try {
        const response = await api.get<ApiResponse<User>>('/users/me');
        if (response.data?.success && response.data.data) {
          setUser(response.data.data);
          return response.data.data;
        }
        return null;
      } catch (error) {
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setUser(null);
        setToken(null);
        return null;
      } finally {
        setIsLoading(false);
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, []);

  useEffect(() => {
    let active = true;

    // Single session listener is the source of truth for auth state.
    // On mount, supabase-js v2 emits INITIAL_SESSION with the restored session,
    // which is the ONLY trigger for the initial /users/me request.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        localStorage.setItem('crm_access_token', session.access_token);
        setToken(session.access_token);
        await refreshProfile();
      } else if (active) {
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setToken(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
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
      // Client records are user-scoped. Do not let a previous account's cache
      // survive an account switch in the same browser session.
      queryClient.removeQueries({ queryKey: ['clients'] });
      localStorage.setItem('crm_access_token', accessToken);
      if (data.session.refresh_token) {
        localStorage.setItem('crm_refresh_token', data.session.refresh_token);
      }
      setToken(accessToken);

      // 2. Fetch DB-verified user profile from FastAPI backend (single source of truth)
      const userData = await refreshProfile();
      if (!userData) {
        await supabase.auth.signOut();
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        setToken(null);
        setUser(null);
        throw new Error('User profile record not found in database.');
      }

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
    // Remove web push subscription so the next account does not receive this browser's pushes
    unsubscribeFromPush().catch(() => undefined);
    localStorage.removeItem('crm_access_token');
    localStorage.removeItem('crm_refresh_token');
    queryClient.removeQueries({ queryKey: ['clients'] });
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
