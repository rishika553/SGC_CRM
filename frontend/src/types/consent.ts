import { Client } from './client';
import { User } from './index';

export type ConsentStatus = 'pending' | 'allowed' | 'denied';

export interface Consent {
  id: string;
  title: string;
  description?: string | null;
  status: ConsentStatus;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  responded_at?: string | null;
  denial_reason?: string | null;
  response_notes?: string | null;
  client_id: string;
  responded_by_id?: string | null;
  created_by_id?: string | null;
  client?: Client;
  responded_by?: User | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  assignees?: { id: string; user_id: string; user?: { id: string; first_name: string; last_name: string } }[];
}

export interface ConsentResponsePayload {
  status: 'allowed' | 'denied';
  denial_reason?: string;
  response_notes?: string;
}
