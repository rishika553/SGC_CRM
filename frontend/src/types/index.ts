export type UserRole =
  | 'super_admin'
  | 'firm_admin'
  | 'managing_consultant'
  | 'senior_consultant'
  | 'consultant'
  | 'client_viewer';

export interface Role {
  id: string;
  name: UserRole;
  display_name: string;
  description?: string;
}

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  job_title?: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  role: Role;
  organization?: Organization;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface PaginatedMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginatedMeta;
}
