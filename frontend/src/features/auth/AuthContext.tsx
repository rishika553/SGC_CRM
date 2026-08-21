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

function clearLocalAuth() {
  localStorage.removeItem('crm_access_token');
  localStorage.removeItem('crm_refresh_token');
  queryClient.clear();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('crm_access_token'));
  const hasStoredToken = !!localStorage.getItem('crm_access_token');
  const [isLoading, setIsLoading] = useState<boolean>(hasStoredToken);
  const refreshInFlight = useRef<Promise<User | null> | null>(null);
  // Guard: when true, the onAuthStateChange listener must NOT clear auth state
  // because login() is in flight and owns the session lifecycle.
  const loginInProgress = useRef(false);

  const refreshProfile = useCallback((): Promise<User | null> => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const currentToken = localStorage.getItem('crm_access_token');
    if (!currentToken) {
      setUser(null);
      setToken(null);
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
      } catch (error: any) {
        const status = error?.response?.status;
        // Backend down / cold-start / transient — keep the token so we retry
        // on next navigation rather than destroying the Supabase session.
        if (!status || status === 404 || status === 500 || status === 502 || status === 503) {
          console.warn(`[Auth] /users/me returned ${status ?? 'network'} — keeping session for retry`);
          return null;
        }
        // 401 / 403 / session_not_found — clear LOCAL state only.
        // Do NOT call supabase.auth.signOut() here.  Only the explicit
        // logout() action should destroy the Supabase session, otherwise
        // a race between onAuthStateChange and login() will nuke the
        // brand-new session with a "session_not_found" error.
        clearLocalAuth();
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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // During an active login() call, the login function owns the full lifecycle.
      // The listener should only update the token; it must NOT clear state on
      // SIGNED_OUT events triggered by our own error-handling signOut() calls,
      // because that would race with the in-flight login.
      if (loginInProgress.current) {
        if (session?.access_token) {
          localStorage.setItem('crm_access_token', session.access_token);
          setToken(session.access_token);
        }
        return;
      }

      if (session?.access_token) {
        localStorage.setItem('crm_access_token', session.access_token);
        setToken(session.access_token);
        await refreshProfile();
      } else if (active) {
        clearLocalAuth();
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
    loginInProgress.current = true;
    setIsLoading(true);
    try {
      let email = emailInput.trim();
      if (!email.includes('@')) {
        email = `${email}@sgccrm.com`;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.session) {
        throw new Error(error?.message || 'Authentication failed. Please check your credentials.');
      }

      const accessToken = data.session.access_token;
      queryClient.removeQueries({ queryKey: ['clients'] });
      localStorage.setItem('crm_access_token', accessToken);
      if (data.session.refresh_token) {
        localStorage.setItem('crm_refresh_token', data.session.refresh_token);
      }
      setToken(accessToken);

      const userData = await refreshProfile();
      if (!userData) {
        // Backend returned an error but we do NOT destroy the Supabase session.
        // The user can retry — the backend may be cold-starting.
        clearLocalAuth();
        setToken(null);
        setUser(null);
        throw new Error('User profile record not found in database. The backend may be starting up — please try again in a moment.');
      }

      const rawRole = userData.role?.name ? String(userData.role.name).toLowerCase() : '';
      const isClientUser = rawRole === 'client' || rawRole === 'client_viewer';
      const isAdminUser = rawRole === 'super_admin' || rawRole === 'admin';

      if (portal === 'superadmin' && !isAdminUser) {
        clearLocalAuth();
        setToken(null);
        setUser(null);
        throw new Error('Access Denied: Client accounts cannot access the Super Admin Portal. Please use the Client Login page.');
      }

      if (portal === 'client' && !isClientUser) {
        clearLocalAuth();
        setToken(null);
        setUser(null);
        throw new Error('Access Denied: Corporate Admin accounts cannot access the Client Portal. Please use the Super Admin Login page.');
      }

      setUser(userData);
    } catch (err) {
      throw err;
    } finally {
      loginInProgress.current = false;
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if Supabase offline
    }
    unsubscribeFromPush().catch(() => undefined);
    clearLocalAuth();
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
