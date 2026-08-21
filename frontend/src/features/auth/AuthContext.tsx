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
  localStorage.removeItem('crm_active_client_id');
  localStorage.removeItem('crm_active_client_name');
  sessionStorage.clear();
  queryClient.clear();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const refreshInFlight = useRef<Promise<User | null> | null>(null);
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
        console.error('[Auth] /users/me returned non-success:', response.data);
        return null;
      } catch (error: any) {
        const status = error?.response?.status;
        const body = error?.response?.data;
        const url = error?.config?.url || '/users/me';
        console.error(`[Auth] /users/me FAILED [${status ?? 'network'}] url=${url}`, {
          status,
          url: error?.config?.baseURL ? error.config.baseURL + url : url,
          message: error?.message,
          responseBody: body,
        });
        if (!status || status === 404 || status === 500 || status === 502 || status === 503) {
          return null;
        }
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

  // On mount: validate the Supabase session server-side (not just localStorage).
  // This catches expired/revoked sessions, back-button cache, and stale tokens.
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active) return;

        if (error || !session?.access_token) {
          clearLocalAuth();
          setUser(null);
          setToken(null);
          setIsLoading(false);
          return;
        }

        localStorage.setItem('crm_access_token', session.access_token);
        if (session.refresh_token) {
          localStorage.setItem('crm_refresh_token', session.refresh_token);
        }
        setToken(session.access_token);

        try {
          const response = await api.get<ApiResponse<User>>('/users/me');
          if (active && response.data?.success && response.data.data) {
            setUser(response.data.data);
          } else if (active) {
            clearLocalAuth();
            setToken(null);
          }
        } catch {
          if (active) console.warn('[Auth] /users/me failed during mount — will retry on next navigation');
        }
      } catch {
        // Unexpected error during session check.
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => { active = false; };
  }, []);

  // Listen for Supabase session changes (token refresh, sign-out from other tabs).
  useEffect(() => {
    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
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
      } else if (active && event === 'SIGNED_OUT') {
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
        console.error('[Auth] login() failed: refreshProfile() returned null — backend /users/me is unreachable or returned an error.');
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
    window.location.replace('/superadmin/login');
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
