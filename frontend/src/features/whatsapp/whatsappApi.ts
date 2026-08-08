/**
 * WhatsApp API helpers — thin wrappers around the FastAPI /whatsapp/* proxy.
 * All calls automatically carry the CRM JWT via the shared axios instance.
 */
import { api } from '@/lib/axios';

export interface WAStatusResponse {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  connected: boolean;
  user: { wid: string | null; pushname: string | null } | null;
}

export interface WAChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  timestamp: number;
  lastMessage: {
    id: string;
    body: string;
    type: string;
    fromMe: boolean;
    timestamp: number;
  } | null;
  isArchived: boolean;
  isMuted: boolean;
}

export interface WAMessage {
  id: string;
  body: string;
  type: string;
  from: string;
  to: string;
  fromMe: boolean;
  timestamp: number;
  ack: number;
  hasMedia: boolean;
  contactName: string;
  contactNumber: string;
  chatId: string;
  chatName: string;
}

async function unwrap<T>(promise: Promise<any>): Promise<T> {
  const res = await promise;
  return res.data?.data ?? res.data;
}

export const whatsappApi = {
  async getStatus(): Promise<WAStatusResponse> {
    const res = await api.get('/whatsapp/status');
    return res.data?.data ?? res.data;
  },

  async getQr(): Promise<{ qr: string | null; status: string }> {
    const res = await api.get('/whatsapp/qr');
    return res.data?.data ?? res.data;
  },

  async connect(): Promise<void> {
    await api.post('/whatsapp/connect');
  },

  async disconnect(): Promise<void> {
    await api.post('/whatsapp/disconnect');
  },

  async getChats(limit = 50): Promise<{ data: WAChat[]; total: number }> {
    const res = await api.get('/whatsapp/chats', { params: { limit } });
    return res.data?.data ?? { data: [], total: 0 };
  },

  async getMessages(chatId: string, limit = 50): Promise<{ data: WAMessage[]; total: number }> {
    const encoded = encodeURIComponent(chatId);
    const res = await api.get(`/whatsapp/messages/${encoded}`, { params: { limit } });
    return res.data?.data ?? { data: [], total: 0 };
  },

  async sendMessage(chatId: string, message: string): Promise<WAMessage> {
    const res = await api.post('/whatsapp/send', { chatId, message });
    return res.data?.data;
  },

  async markRead(chatId: string): Promise<void> {
    const encoded = encodeURIComponent(chatId);
    await api.post(`/whatsapp/mark-read/${encoded}`);
  },

  async checkServiceHealth(): Promise<boolean> {
    try {
      const res = await api.get('/whatsapp/health');
      return res.data?.success === true;
    } catch {
      return false;
    }
  },
};
