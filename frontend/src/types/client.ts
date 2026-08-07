import { User } from './index';

export type ClientTier = 'enterprise' | 'mid_market' | 'smb';
export type ClientStatus = 'active' | 'prospect' | 'churned';
export type CommunicationType = 'meeting' | 'call' | 'email' | 'note';

export interface Contact {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department?: string;
  is_primary_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLog {
  id: string;
  client_id: string;
  contact_id?: string;
  type: CommunicationType;
  subject: string;
  notes: string;
  interaction_date: string;
  logged_by: User;
  contact?: Contact;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  industry?: string;
  company_size?: string;
  website?: string;
  billing_address?: string;
  annual_revenue?: number;
  tier: ClientTier;
  status: ClientStatus;
  account_manager?: User;
  contacts: Contact[];
  created_at: string;
  updated_at: string;
}

export interface ClientDetail extends Client {
  communication_logs: CommunicationLog[];
}
