import axios from 'axios';
import { supabase } from './supabase';
import { queryClient } from './query-client';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 60000, // Bound request time so a cold server/hung DB never leaves the UI Pending forever
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
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const loginPaths = ['/login', '/superadmin/login', '/client/login'];
      if (!loginPaths.includes(window.location.pathname)) {
        localStorage.removeItem('crm_access_token');
        localStorage.removeItem('crm_refresh_token');
        try {
          await supabase.auth.signOut();
        } catch (e) {
          // Ignore Supabase errors
        }
        queryClient.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
