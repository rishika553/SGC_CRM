/**
 * useWhatsAppSocket
 * Manages the Socket.IO connection to the WhatsApp Node.js microservice.
 * Provides real-time QR updates, status changes, incoming messages, and acks.
 */
import { useEffect, useRef, useCallback } from 'react';

const WA_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3001';

export type WAStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface WAUser {
  wid: string | null;
  pushname: string | null;
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

export interface WASocketCallbacks {
  onStatusChange?: (status: WAStatus, user: WAUser | null, error?: string) => void;
  onQrUpdate?: (qr: string, status: WAStatus) => void;
  onNewMessage?: (message: WAMessage) => void;
  onMessageAck?: (id: string, ack: number) => void;
}

export function useWhatsAppSocket(crmUserId: string | undefined, callbacks: WASocketCallbacks) {
  const socketRef = useRef<any>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref fresh without re-connecting
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!crmUserId) return;

    // Dynamically import socket.io-client to avoid bundling issues if not installed
    let isMounted = true;

    const connect = async () => {
      try {
        // Use global io from CDN or npm package
        const { io } = await import('socket.io-client');

        const socket = io(WA_SERVICE_URL, {
          query: { crmUserId },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
          if (!isMounted) return;
          console.log('[WA-Socket] Connected to WhatsApp service');
        });

        socket.on('disconnect', () => {
          if (!isMounted) return;
          console.log('[WA-Socket] Disconnected from WhatsApp service');
        });

        socket.on('status_change', ({ status, user, error }: any) => {
          if (!isMounted) return;
          callbacksRef.current.onStatusChange?.(status, user, error);
        });

        socket.on('qr_update', ({ qr, status }: any) => {
          if (!isMounted) return;
          callbacksRef.current.onQrUpdate?.(qr, status);
        });

        socket.on('new_message', (message: WAMessage) => {
          if (!isMounted) return;
          callbacksRef.current.onNewMessage?.(message);
        });

        socket.on('message_ack', ({ id, ack }: any) => {
          if (!isMounted) return;
          callbacksRef.current.onMessageAck?.(id, ack);
        });

        socketRef.current = socket;
      } catch (err) {
        console.warn('[WA-Socket] socket.io-client not available, falling back to polling:', err);
      }
    };

    connect();

    return () => {
      isMounted = false;
      disconnect();
    };
  }, [crmUserId, disconnect]);

  return { disconnect };
}
