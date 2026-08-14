import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Client } from '@/types/client';
import { ApiResponse, PaginatedResponse } from '@/types';

export const clientQueryKeys = {
  directory: ['clients', 'directory'] as const,
  mine: ['clients', 'me'] as const,
};

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
