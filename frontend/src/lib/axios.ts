import axios from 'axios';
import { queryClient } from './query-client';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for automatic 401 handling
// IMPORTANT: We only clear LOCAL state here.  Never call supabase.auth.signOut()
// from an interceptor — it races with in-flight login() calls and causes
// "session_not_found" errors by destroying the brand-new Supabase session.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const loginPaths = ['/login', '/superadmin/login', '/client/login'];
      if (!loginPaths.includes(window.location.pathname)) {
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        queryClient.clear();
        window.location.href = '/superadmin/login';
      }
    }
    return Promise.reject(error);
  }
);
