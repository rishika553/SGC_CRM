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

  const login = async (email: string, password: string, portal?: string) => {
    setIsLoading(true);
    try {
      // Direct backend API login with portal role verification
      const response = await api.post('/auth/login', { email, password, portal });
      const { access_token, refresh_token, user: userData } = response.data.data;

      localStorage.setItem('crm_access_token', access_token);
      localStorage.setItem('crm_refresh_token', refresh_token);
      setToken(access_token);
      setUser(userData);
    } catch (err) {
      // Fallback to Supabase auth if backend API throws network error
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.session) {
          const accessToken = data.session.access_token;
          localStorage.setItem('crm_access_token', accessToken);
          setToken(accessToken);
          await refreshProfile();
          return;
        }
      } catch (supabaseErr) {}
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if Supabase client offline
    }
    localStorage.removeItem('crm_access_token');
    localStorage.removeItem('crm_refresh_token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
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
