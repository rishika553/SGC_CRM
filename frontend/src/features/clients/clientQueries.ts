import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { Client } from '@/types/client';
import { ApiResponse, PaginatedResponse } from '@/types';

export const clientQueryKeys = {
  directory: ['clients', 'directory'] as const,
  mine: ['clients', 'me'] as const,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(str?: string | null): boolean {
  return Boolean(str && UUID_RE.test(str));
}

export async function fetchClientDirectory(): Promise<Client[]> {
  const response = await api.get<PaginatedResponse<Client>>('/clients', {
    params: { page: 1, page_size: 100 },
  });

  return response.data.success ? response.data.data : [];
}

export async function fetchMyClient(): Promise<Client | null> {
  const response = await api.get<ApiResponse<Client>>('/clients/me');
  return response.data.success && response.data.data ? response.data.data : null;
}

/**
 * Ensures `crm_active_client_id` is set in localStorage.
 * For super-admins this is a no-op. For client-role users, it calls
 * `/clients/me` to resolve the linked client and persists the ID.
 * Pass `isClientRole=true` for client-role users; otherwise returns null.
 * Returns the resolved client UUID or null.
 */
export async function resolveClientIdForCurrentUser(isClientRole = false): Promise<string | null> {
  const stored = localStorage.getItem('crm_active_client_id');

  if (!isClientRole) {
    // Admin/superadmin users: never scope to a client UUID from localStorage.
    // Clear any stale client UUID so subsequent page loads stay unscoped.
    if (isUUID(stored)) {
      localStorage.removeItem('crm_active_client_id');
      localStorage.removeItem('crm_active_client_name');
    }
    return null;
  }

  if (isUUID(stored)) return stored;
  if (stored === 'superadmin') return null;

  try {
    const profile = await queryClient.fetchQuery({
      queryKey: clientQueryKeys.mine,
      queryFn: fetchMyClient,
    });
    if (profile?.id) {
      localStorage.setItem('crm_active_client_id', profile.id);
      localStorage.setItem('crm_active_client_name', profile.name);
      return profile.id;
    }
  } catch {}
  return null;
}

export function useClientDirectory(enabled = true) {
  return useQuery({
    queryKey: clientQueryKeys.directory,
    queryFn: fetchClientDirectory,
    enabled,
  });
}

export function useMyClient(enabled = true) {
  return useQuery({
    queryKey: clientQueryKeys.mine,
    queryFn: fetchMyClient,
    enabled,
  });
}
