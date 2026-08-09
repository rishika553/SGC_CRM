/**
 * WhatsApp Page — Full WhatsApp Web integration inside the CRM
 * Features: chat list, conversation view, send/receive, real-time Socket.IO,
 *   unread counts, search, connect/disconnect, QR flow.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageCircle, Search, Send, ArrowLeft, Wifi, WifiOff, QrCode,
  RefreshCw, LogOut, CheckCircle2, ShieldAlert, Phone, User as UserIcon,
  Users, Circle, Check, CheckCheck, Image as ImageIcon, FileText,
  Paperclip, X, ChevronRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { whatsappApi, WAChat, WAMessage, WAStatusResponse } from '@/features/whatsapp/whatsappApi';
import { useWhatsAppSocket, WAStatus } from '@/features/whatsapp/useWhatsAppSocket';

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatTimestamp(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function formatFullTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getContactInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAckIcon(ack: number, fromMe: boolean) {
  if (!fromMe) return null;
  if (ack >= 3) return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
  if (ack >= 2) return <CheckCheck className="w-3.5 h-3.5 text-white/60" />;
  return <Check className="w-3.5 h-3.5 text-white/60" />;
}

// ── Connect Panel (QR / Status) ──────────────────────────────────────────────
interface ConnectPanelProps {
  status: WAStatus;
  qrCode: string | null;
  connectedUser: { wid: string | null; pushname: string | null } | null;
  isLoading: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ConnectPanel: React.FC<ConnectPanelProps> = ({
  status, qrCode, connectedUser, isLoading, error, onConnect, onDisconnect,
}) => (
  <div className="flex flex-col items-center justify-center h-full p-5 sm:p-8 space-y-6 bg-[#F9FAF9]">
    <div className="w-full max-w-sm space-y-5">
      {/* Status badge */}
      <div className="flex items-center justify-between p-3.5 bg-white border border-[#E3E8E3] rounded-2xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">WhatsApp Status</div>
            <div className="text-sm font-extrabold text-[#27332B] capitalize">
              {status === 'qr_ready' ? 'Scan QR Code' : status}
            </div>
          </div>
        </div>
        {status === 'connected' && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Connected
          </span>
        )}
        {(status === 'connecting' || status === 'qr_ready') && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-700" />
            {status === 'qr_ready' ? 'Awaiting Scan' : 'Initializing'}
          </span>
        )}
        {status === 'disconnected' && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <WifiOff className="w-3.5 h-3.5 text-slate-500" />Disconnected
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Service Unavailable</p>
            <p className="text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main content area */}
      {status === 'connected' && connectedUser ? (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-emerald-950">WhatsApp Connected!</h4>
            <p className="text-xs font-medium text-emerald-800 mt-1">
              {connectedUser.pushname || 'WhatsApp Account'}
            </p>
            {connectedUser.wid && (
              <p className="text-[11px] font-mono text-emerald-700 mt-0.5">
                +{connectedUser.wid.replace('@c.us', '')}
              </p>
            )}
          </div>
          <p className="text-xs text-emerald-700">Select a chat from the left panel to start messaging.</p>
        </div>
      ) : status === 'qr_ready' && qrCode ? (
        <div className="space-y-4 text-center">
          <div className="p-4 bg-white border border-[#E3E8E3] rounded-2xl shadow-xs inline-block mx-auto">
            <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-lg" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#27332B]">Scan with WhatsApp on your phone</p>
            <p className="text-[11px] text-[#6B7280] mt-1 max-w-xs mx-auto">
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
          </div>
        </div>
      ) : status === 'connecting' ? (
        <div className="py-10 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#2F4F3A] mx-auto" />
          <p className="text-xs font-semibold text-[#6B7280]">Starting browser & generating QR code...</p>
        </div>
      ) : (
        <div className="py-8 text-center space-y-2">
          <QrCode className="w-10 h-10 text-[#6B7280] mx-auto opacity-40" />
          <p className="text-xs text-[#6B7280]">Connect WhatsApp to start sending and receiving messages.</p>
        </div>
      )}

      {/* Action button */}
      <div className="flex justify-center">
        {status === 'connected' ? (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            isLoading={isLoading}
            onClick={onDisconnect}
          >
            Disconnect WhatsApp
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Wifi className="w-4 h-4" />}
            isLoading={isLoading || status === 'connecting'}
            onClick={onConnect}
          >
            Connect WhatsApp
          </Button>
        )}
      </div>
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
export const WhatsAppPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Connection state
  const [waStatus, setWaStatus] = useState<WAStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectedUser, setConnectedUser] = useState<{ wid: string | null; pushname: string | null } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  // Chat state
  const [chats, setChats] = useState<WAChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Unread counts (chatId → count) — maintained locally for real-time updates
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Socket.IO real-time callbacks ────────────────────────────────────────
  const handleStatusChange = useCallback((status: WAStatus, user: typeof connectedUser, error?: string) => {
    setWaStatus(status);
    setConnectedUser(user);
    if (error) setServiceError(error);
    if (status === 'connected') {
      setServiceError(null);
      // Load chats on connect
      loadChats();
    }
    if (status === 'disconnected') {
      setChats([]);
      setMessages([]);
      setActiveChatId(null);
    }
  }, []); // eslint-disable-line

  const handleQrUpdate = useCallback((qr: string, status: WAStatus) => {
    setQrCode(qr);
    setWaStatus(status);
  }, []);

  const handleNewMessage = useCallback((msg: WAMessage) => {
    // If the message belongs to the active chat, append it
    if (msg.chatId === activeChatId) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });
      // Mark read since we're viewing it
      whatsappApi.markRead(msg.chatId).catch(() => {});
    } else {
      // Increment unread count for the chat
      setUnreadCounts((prev) => ({
        ...prev,
        [msg.chatId]: (prev[msg.chatId] || 0) + 1,
      }));
    }

    // Update last message in chat list
    setChats((prev) =>
      prev.map((c) =>
        c.id === msg.chatId
          ? {
              ...c,
              lastMessage: { id: msg.id, body: msg.body, type: msg.type, fromMe: msg.fromMe, timestamp: msg.timestamp },
              timestamp: msg.timestamp,
              unreadCount: msg.chatId === activeChatId ? 0 : (c.unreadCount || 0) + 1,
            }
          : c
      ).sort((a, b) => b.timestamp - a.timestamp)
    );
  }, [activeChatId]);

  useWhatsAppSocket(currentUser?.id, {
    onStatusChange: handleStatusChange,
    onQrUpdate: handleQrUpdate,
    onNewMessage: handleNewMessage,
  });

  // ── Initial status fetch + polling for QR updates ─────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const s = await whatsappApi.getStatus();
        if (cancelled) return;
        setWaStatus(s.status);
        setConnectedUser(s.user);
        setServiceError(null);
        if (s.status === 'qr_ready' || s.status === 'connecting') {
          const qrRes = await whatsappApi.getQr();
          if (!cancelled && qrRes.qr) setQrCode(qrRes.qr);
        } else {
          setQrCode(null);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err.response?.data?.error?.message || 'WhatsApp service offline (port 3001)';
        setServiceError(msg);
        setWaStatus('disconnected');
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 2500);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  // Load chats when status becomes connected
  useEffect(() => {
    if (waStatus === 'connected') loadChats();
  }, [waStatus]); // eslint-disable-line

  // ── Data fetching ────────────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    try {
      const result = await whatsappApi.getChats(100);
      const chatList = result.data || [];
      setChats(chatList);
      // Seed unread counts from chat list
      const counts: Record<string, number> = {};
      chatList.forEach((c) => { if (c.unreadCount > 0) counts[c.id] = c.unreadCount; });
      setUnreadCounts(counts);
    } catch (err: any) {
      toast('Failed to load chats', err.response?.data?.error?.message || 'Unknown error', 'error');
    } finally {
      setChatsLoading(false);
    }
  }, [toast]);

  const loadMessages = useCallback(async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const result = await whatsappApi.getMessages(chatId, 50);
      setMessages(result.data || []);
      // Mark read
      await whatsappApi.markRead(chatId);
      setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
      setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, unreadCount: 0 } : c));
    } catch (err: any) {
      toast('Failed to load messages', err.response?.data?.error?.message || 'Unknown error', 'error');
    } finally {
      setMessagesLoading(false);
    }
  }, [toast]);

  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setShowMobileChat(true);
    loadMessages(chatId);
  }, [loadMessages]);

  // ── Connect / Disconnect ─────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      setServiceError(null);
      setQrCode(null);
      await whatsappApi.connect();
      setWaStatus('connecting');
      toast('WhatsApp', 'Starting browser session...', 'info');

      // Poll for QR while Chromium initializes (can take 15–30s on first launch)
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const qrRes = await whatsappApi.getQr();
          if (qrRes.qr) {
            setQrCode(qrRes.qr);
            setWaStatus('qr_ready');
            break;
          }
          const statusRes = await whatsappApi.getStatus();
          setWaStatus(statusRes.status);
          if (statusRes.status === 'connected') break;
          if (statusRes.status === 'disconnected') break;
        } catch {
          // keep polling until attempts exhausted
        }
      }
    } catch (err: any) {
      toast('Connection Error', err.response?.data?.error?.message || 'Failed to start WhatsApp', 'error');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setConnectLoading(true);
    try {
      await whatsappApi.disconnect();
      setWaStatus('disconnected');
      setQrCode(null);
      setConnectedUser(null);
      setChats([]);
      setMessages([]);
      setActiveChatId(null);
      toast('Disconnected', 'WhatsApp session ended.', 'info');
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to disconnect', 'error');
    } finally {
      setConnectLoading(false);
    }
  };

  // ── Send Message ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeChatId || isSending) return;

    const text = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // Optimistic message
    const optimistic: WAMessage = {
      id: `temp-${Date.now()}`,
      body: text,
      type: 'chat',
      from: connectedUser?.wid || '',
      to: activeChatId,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 0,
      hasMedia: false,
      contactName: connectedUser?.pushname || 'Me',
      contactNumber: connectedUser?.wid?.replace('@c.us', '') || '',
      chatId: activeChatId,
      chatName: chats.find((c) => c.id === activeChatId)?.name || activeChatId,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const sent = await whatsappApi.sendMessage(activeChatId, text);
      // Replace optimistic with real message
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? { ...optimistic, id: sent.id, ack: 1 } : m)
      );
      // Update chat list last message
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, timestamp: sent.timestamp, lastMessage: { id: sent.id, body: text, type: 'chat', fromMe: true, timestamp: sent.timestamp } }
            : c
        ).sort((a, b) => b.timestamp - a.timestamp)
      );
    } catch (err: any) {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputMessage(text);
      toast('Send Failed', err.response?.data?.error?.message || 'Message not delivered', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter((c) => c.name.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId), [chats, activeChatId]);

  const totalUnread = useMemo(() =>
    Object.values(unreadCounts).reduce((sum, n) => sum + n, 0),
  [unreadCounts]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <MainLayout clientName="All Accounts" pageTitle="WhatsApp">
      <div className="h-[calc(100vh-140px)] h-[calc(100dvh-140px)] bg-white border border-[#E3E8E3] rounded-[24px] shadow-[0_8px_30px_rgba(47,79,58,.06)] overflow-hidden flex flex-col md:flex-row">

        {/* ── LEFT: Chat List ─────────────────────────────────────────────── */}
        <div className={cn(
          'w-full md:w-[340px] border-r border-[#E3E8E3] bg-[#F9FAF9] flex flex-col shrink-0',
          showMobileChat ? 'hidden md:flex' : 'flex'
        )}>
          {/* Header */}
          <div className="p-4 border-b border-[#E3E8E3] bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#27332B]">WhatsApp</h2>
                  <p className="text-[10px] text-[#6B7280] font-medium">
                    {waStatus === 'connected' ? `Connected · ${chats.length} chats` : 'Not connected'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {totalUnread > 0 && (
                  <span className="bg-[#25D366] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {totalUnread}
                  </span>
                )}
                {/* Status dot */}
                <div className={cn('w-2.5 h-2.5 rounded-full border-2 border-white',
                  waStatus === 'connected' ? 'bg-emerald-500' :
                  waStatus === 'connecting' || waStatus === 'qr_ready' ? 'bg-amber-400 animate-pulse' :
                  'bg-slate-400'
                )} title={waStatus} />
              </div>
            </div>
            {waStatus === 'connected' && (
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-[#6B7280]" />}
                className="bg-[#F7F9F6] border-[#E3E8E3] text-xs h-9"
              />
            )}
          </div>

          {/* Chat list body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E3E8E3]/60">
            {waStatus !== 'connected' ? (
              /* Not connected — show compact connect area */
              <div className="p-5 space-y-4">
                {serviceError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <p>{serviceError}</p>
                  </div>
                )}
                {waStatus === 'qr_ready' && qrCode && (
                  <div className="text-center space-y-3">
                    <div className="p-3 bg-white border border-[#E3E8E3] rounded-xl shadow-xs inline-block">
                      <img src={qrCode} alt="QR" className="w-44 h-44 rounded-lg mx-auto" />
                    </div>
                    <p className="text-[11px] text-[#6B7280]">Scan with WhatsApp on your phone</p>
                  </div>
                )}
                {waStatus === 'connecting' && (
                  <div className="py-6 text-center space-y-2">
                    <RefreshCw className="w-7 h-7 animate-spin text-[#2F4F3A] mx-auto" />
                    <p className="text-xs text-[#6B7280]">Starting session...</p>
                  </div>
                )}
                {waStatus === 'disconnected' && (
                  <div className="py-4 text-center space-y-3">
                    <QrCode className="w-10 h-10 text-[#6B7280] mx-auto opacity-40" />
                    <p className="text-xs text-[#6B7280]">Connect WhatsApp to view your messages.</p>
                    <Button size="sm" variant="primary" leftIcon={<Wifi className="w-4 h-4" />}
                      isLoading={connectLoading} onClick={handleConnect}>
                      Connect WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            ) : chatsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7280]">
                {searchQuery ? 'No chats match your search.' : 'No chats found.'}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = chat.id === activeChatId;
                const unread = unreadCounts[chat.id] || chat.unreadCount || 0;
                return (
                  <button key={chat.id} type="button"
                    onClick={() => handleSelectChat(chat.id)}
                    className={cn(
                      'w-full p-3.5 text-left flex items-start gap-3 transition-colors hover:bg-white',
                      isActive ? 'bg-white border-l-4 border-l-[#25D366]' : ''
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs shrink-0"
                      style={{ background: '#2F4F3A', color: '#DCE9DE' }}>
                      {chat.isGroup
                        ? <Users className="w-5 h-5" />
                        : getContactInitials(chat.name)
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#27332B] truncate">{chat.name}</span>
                        <span className="text-[10px] text-[#6B7280] shrink-0">
                          {formatTimestamp(chat.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] truncate mt-0.5">
                        {chat.lastMessage
                          ? (chat.lastMessage.fromMe ? '✓ ' : '') + (chat.lastMessage.body || '📎 Media')
                          : 'No messages yet'
                        }
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="bg-[#25D366] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom: Disconnect button when connected */}
          {waStatus === 'connected' && (
            <div className="p-3 border-t border-[#E3E8E3] bg-white">
              <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50"
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
                isLoading={connectLoading} onClick={handleDisconnect}>
                Disconnect WhatsApp
              </Button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Conversation / Connect Panel ─────────────────────── */}
        <div className={cn(
          'flex-1 flex flex-col bg-white overflow-hidden',
          !showMobileChat ? 'hidden md:flex' : 'flex'
        )}>
          {waStatus !== 'connected' || !activeChatId ? (
            /* Show connect panel when not connected or no chat selected */
            <ConnectPanel
              status={waStatus}
              qrCode={qrCode}
              connectedUser={connectedUser}
              isLoading={connectLoading}
              error={serviceError}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ) : (
            <>
              {/* Chat header */}
              <div className="p-3.5 px-5 border-b border-[#E3E8E3] flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1 text-[#27332B] hover:bg-[#EEF5EF] rounded-lg">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-[#2F4F3A] text-[#DCE9DE] font-bold text-xs flex items-center justify-center shadow-xs">
                    {activeChat?.isGroup ? <Users className="w-5 h-5" /> : getContactInitials(activeChat?.name || '?')}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#27332B]">{activeChat?.name}</h3>
                    <p className="text-[11px] text-[#6B7280]">
                      {activeChat?.isGroup ? 'Group Chat' : 'WhatsApp Contact'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => loadMessages(activeChatId)}
                    className="p-2 text-[#6B7280] hover:text-[#2F4F3A] hover:bg-[#EEF5EF] rounded-xl transition-colors"
                    title="Refresh messages">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#ECE5DD]"
                style={{ backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")' }}>
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#2F4F3A]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-[#6B7280] bg-white/70 px-3 py-1.5 rounded-full">
                      No messages yet. Send a message below.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={cn('flex flex-col max-w-[80%]', msg.fromMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
                      {!msg.fromMe && (
                        <span className="text-[10px] font-bold text-[#2F4F3A] mb-1 px-1">{msg.contactName}</span>
                      )}
                      <div className={cn(
                        'px-3 py-2 rounded-xl shadow-xs text-sm leading-relaxed relative',
                        msg.fromMe
                          ? 'bg-[#DCF8C6] text-[#1a2e1a] rounded-tr-none'
                          : 'bg-white text-[#27332B] rounded-tl-none'
                      )}>
                        {msg.hasMedia ? (
                          <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                            <ImageIcon className="w-4 h-4" />
                            <span>Media</span>
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        )}
                        <div className={cn('flex items-center justify-end gap-1 mt-1', msg.fromMe ? 'text-[#2F4F3A]/60' : 'text-[#6B7280]')}>
                          <span className="text-[10px]">{formatFullTime(msg.timestamp)}</span>
                          {getAckIcon(msg.ack, msg.fromMe)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <form onSubmit={handleSendMessage}
                className="p-3 border-t border-[#E3E8E3] bg-[#F0F0F0] flex items-center gap-2">
                <Input
                  placeholder="Type a message"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSendMessage(); }}
                  className="bg-white border-[#E3E8E3] text-sm h-10 rounded-full flex-1"
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-[#25D366] hover:bg-[#1ebe5a] border-0 h-10 w-10 p-0 rounded-full shrink-0"
                  isLoading={isSending}
                  disabled={!inputMessage.trim()}
                >
                  {!isSending && <Send className="w-4 h-4" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default WhatsAppPage;
