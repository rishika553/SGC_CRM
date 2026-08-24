import { api } from '@/lib/axios';
import { Consent, ConsentResponsePayload, ConsentStatus } from '@/types/consent';
import { PaginatedResponse } from '@/types';

export interface ConsentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ConsentStatus;
  client_id?: string;
}

export interface CreateConsentPayload {
  client_id: string;
  title: string;
  description?: string;
  file?: File | null;
}

export const consentApi = {
  async list(params: ConsentListParams = {}): Promise<PaginatedResponse<Consent>> {
    const res = await api.get<PaginatedResponse<Consent>>('/consents', { params });
    return res.data;
  },

  async get(id: string): Promise<Consent> {
    const res = await api.get<{ data: Consent }>(`/consents/${id}`);
    return res.data.data;
  },

  async create(payload: CreateConsentPayload): Promise<Consent> {
    const formData = new FormData();
    formData.append('client_id', payload.client_id);
    formData.append('title', payload.title);
    if (payload.description && payload.description.trim()) {
      formData.append('description', payload.description);
    }
    if (payload.file) {
      formData.append('file', payload.file);
    }
    const res = await api.post<{ data: Consent }>('/consents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async respond(id: string, payload: ConsentResponsePayload): Promise<Consent> {
    const res = await api.post<{ data: Consent }>(`/consents/${id}/respond`, payload);
    return res.data.data;
  },

  async update(id: string, payload: { assignee_ids?: string[] }): Promise<Consent> {
    const res = await api.patch<{ data: Consent }>(`/consents/${id}`, payload);
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/consents/${id}`);
  },

  async download(id: string): Promise<void> {
    const res = await api.get(`/consents/${id}/download`, { responseType: 'blob' });
    const disposition = res.headers['content-disposition'] as string | undefined;
    let filename = `ConsentAttachment_${id}`;
    const match = disposition && disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
