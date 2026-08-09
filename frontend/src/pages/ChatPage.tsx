import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Paperclip,
  Smile,
  Send,
  CheckCheck,
  Check,
  Phone,
  Video,
  MoreVertical,
  ArrowLeft,
  FileText,
  Download,
  Image as ImageIcon,
  ShieldCheck,
  UserCheck,
  Circle,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { api } from '@/lib/axios';
import { useAuth } from '@/features/auth/AuthContext';
import { Client } from '@/types/client';
import { PaginatedResponse, User } from '@/types';
import { WhatsAppConnectModal } from '@/features/whatsapp/WhatsAppConnectModal';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'partner';
  senderName: string;
  senderInitials: string;
  text: string;
  timestamp: string;
  readStatus: 'read' | 'delivered' | 'sent';
  attachment?: {
    name: string;
    size: string;
    type: 'pdf' | 'excel' | 'image';
  };
}

export interface Conversation {
  id: string; // Target recipient user ID
  name: string;
  role: string;
  companyName: string;
  initials: string;
  isOnline: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  messages: ChatMessage[];
  isTyping?: boolean;
}

export const ChatPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Search & Input State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState<boolean>(false);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);

  // WebSocket Connection State
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeChatId]);

  // Establish WebSocket Connection with Auto-Reconnection & Heartbeat
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('crm_access_token') || localStorage.getItem('auth_token');
    if (!token || !currentUser?.id) return;

    let isMounted = true;
    let attempts = 0;

    const connectWebSocket = () => {
      if (!isMounted) return;
      setWsStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const wsUrl = `${protocol}//${host}:8000/api/v1/chat/ws?token=${encodeURIComponent(token)}`;

      try {
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (!isMounted) return;
          setWsStatus('connected');
          attempts = 0;
          console.log('Chat WebSocket connected successfully.');
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'new_message' && data.data) {
              const m = data.data;
              const isMe = m.sender_id === currentUser.id;
              const targetUserId = isMe ? m.recipient_id : m.sender_id;

              const incomingMsg: ChatMessage = {
                id: m.id,
                sender: isMe ? 'user' : 'partner',
                senderName: m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'User',
                senderInitials: m.sender ? `${m.sender.first_name[0]}${m.sender.last_name[0]}`.toUpperCase() : 'US',
                text: m.content || '',
                timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                readStatus: m.is_read ? 'read' : 'delivered',
                attachment: m.attachment_name ? {
                  name: m.attachment_name,
                  size: m.attachment_size ? `${(m.attachment_size / (1024 * 1024)).toFixed(1)} MB` : 'File',
                  type: m.attachment_name.endsWith('.xlsx') ? 'excel' : m.attachment_name.endsWith('.png') ? 'image' : 'pdf',
                } : undefined,
              };

              setConversations((prevConvs) =>
                prevConvs.map((conv) => {
                  if (conv.id === targetUserId) {
                    const alreadyExists = conv.messages.some((msg) => msg.id === incomingMsg.id);
                    const updatedMsgs = alreadyExists ? conv.messages : [...conv.messages, incomingMsg];
                    return {
                      ...conv,
                      messages: updatedMsgs,
                      lastMessage: incomingMsg.text,
                      lastMessageTime: incomingMsg.timestamp,
                      unreadCount: !isMe && conv.id !== activeChatId ? conv.unreadCount + 1 : conv.unreadCount,
                    };
                  }
                  return conv;
                })
              );
            }
          } catch (e) {}
        };

        socket.onerror = () => {
          if (!isMounted) return;
          setWsStatus('error');
        };

        socket.onclose = () => {
          if (!isMounted) return;
          setWsStatus('disconnected');
          attempts++;
          const timeout = Math.min(1000 * Math.pow(2, attempts), 10000);
          reconnectTimerRef.current = setTimeout(connectWebSocket, timeout);
        };

        wsRef.current = socket;
      } catch (e) {
        setWsStatus('disconnected');
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentUser?.id]);

  // Load chat channel directory
  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true);
      try {
        if (isClientRole) {
          // Client User: Get Client company profile & Super Admin user
          let clientCompany: Client | null = null;
          let superAdminUser: User | null = null;

          try {
            const clientRes = await api.get('/clients/me');
            if (clientRes.data.success) {
              clientCompany = clientRes.data.data;
            }
          } catch (e) {}

          try {
            const adminRes = await api.get('/users/superadmin');
            if (adminRes.data.success) {
              superAdminUser = adminRes.data.data;
            }
          } catch (e) {}

          const adminName = superAdminUser ? `${superAdminUser.first_name} ${superAdminUser.last_name}` : 'SGC Super Admin';
          const adminInitials = superAdminUser ? `${superAdminUser.first_name[0]}${superAdminUser.last_name[0]}`.toUpperCase() : 'SA';
          const adminId = superAdminUser?.id || 'admin-channel';

          const singleConv: Conversation = {
            id: adminId,
            name: adminName,
            role: 'Virtual CFO / Corporate Admin',
            companyName: clientCompany?.name || 'My Consulting Account',
            initials: adminInitials,
            isOnline: true,
            unreadCount: 0,
            lastMessage: 'Connected to Super Admin support desk.',
            lastMessageTime: 'Just now',
            messages: [],
          };

          setConversations([singleConv]);
          setActiveChatId(adminId);
        } else {
          // Super Admin User: Load all active conversations & client users
          let convList: Conversation[] = [];

          // 1. Fetch conversations from /chat/conversations
          try {
            const convRes = await api.get('/chat/conversations');
            if (convRes.data.success && Array.isArray(convRes.data.data)) {
              convList = convRes.data.data.map((c: any) => {
                const other = c.other_user || {};
                const partnerName = `${other.first_name || ''} ${other.last_name || ''}`.trim() || 'Client User';
                const initials = `${other.first_name?.[0] || 'C'}${other.last_name?.[0] || 'U'}`.toUpperCase();
                return {
                  id: other.id,
                  name: partnerName,
                  role: other.job_title || 'Client Lead',
                  companyName: other.email || 'Client Workspace',
                  initials,
                  isOnline: Boolean(c.is_online),
                  unreadCount: c.unread_count || 0,
                  lastMessage: c.last_message?.content || 'Connected to client chat.',
                  lastMessageTime: c.last_message ? new Date(c.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                  messages: [],
                };
              });
            }
          } catch (e) {}

          // 2. Fetch all registered Client users from /users
          try {
            const usersRes = await api.get<PaginatedResponse<User>>('/users', { params: { page: 1, page_size: 100 } });
            if (usersRes.data.success && Array.isArray(usersRes.data.data)) {
              const clientUsers = usersRes.data.data.filter((u) => {
                const rName = String(u.role?.name || '').toLowerCase();
                return rName === 'client' || rName === 'client_viewer';
              });

              clientUsers.forEach((u) => {
                const existing = convList.find((c) => c.id === u.id);
                if (!existing) {
                  const partnerName = `${u.first_name} ${u.last_name}`;
                  const initials = `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
                  convList.push({
                    id: u.id,
                    name: partnerName,
                    role: u.job_title || 'Client Lead',
                    companyName: u.email,
                    initials,
                    isOnline: true,
                    unreadCount: 0,
                    lastMessage: 'Click to start conversation.',
                    lastMessageTime: '',
                    messages: [],
                  });
                }
              });
            }
          } catch (e) {}

          setConversations(convList);
          if (convList.length > 0) {
            setActiveChatId(convList[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load chat channels:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannels();
  }, [isClientRole, currentUser]);

  // Load message history from DB and sync
  useEffect(() => {
    if (!activeChatId) return;

    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    const syncMessages = async () => {
      if (!isUUID(activeChatId)) return;
      try {
        const res = await api.get(`/chat/messages/${activeChatId}`);
        if (res.data.success && Array.isArray(res.data.data)) {
          const loadedMsgs: ChatMessage[] = res.data.data.map((m: any) => ({
            id: m.id,
            sender: m.sender_id === currentUser?.id ? 'user' : 'partner',
            senderName: m.sender ? `${m.sender.first_name} ${m.sender.last_name}` : 'User',
            senderInitials: m.sender ? `${m.sender.first_name[0]}${m.sender.last_name[0]}`.toUpperCase() : 'US',
            text: m.content || '',
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            readStatus: m.is_read ? 'read' : 'delivered',
            attachment: m.attachment_name ? {
              name: m.attachment_name,
              size: m.attachment_size ? `${(m.attachment_size / (1024 * 1024)).toFixed(1)} MB` : 'File',
              type: m.attachment_name.endsWith('.xlsx') ? 'excel' : m.attachment_name.endsWith('.png') ? 'image' : 'pdf',
            } : undefined,
          }));

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== activeChatId) return c;
              const last = loadedMsgs[loadedMsgs.length - 1];
              return {
                ...c,
                messages: loadedMsgs,
                unreadCount: 0, // Reset unread count when viewing
                lastMessage: last ? last.text : c.lastMessage,
                lastMessageTime: last ? last.timestamp : c.lastMessageTime,
              };
            })
          );
        }
      } catch (e) {}
    };

    syncMessages();
    const interval = setInterval(syncMessages, 2500);

    return () => clearInterval(interval);
  }, [activeChatId, currentUser]);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeChatId) || conversations[0] || null;
  }, [conversations, activeChatId]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConversation) return;

    const textToSend = inputMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: 'user',
      senderName: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Super Admin',
      senderInitials: currentUser ? `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase() : 'SA',
      text: textToSend,
      timestamp: timestampStr,
      readStatus: 'sent',
    };

    // Optimistically update conversation state locally
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversation.id) {
          return {
            ...c,
            messages: [...c.messages, optimisticMsg],
            lastMessage: textToSend,
            lastMessageTime: timestampStr,
          };
        }
        return c;
      })
    );

    setInputMessage('');
    setIsEmojiPickerOpen(false);

    // 1. Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            event: 'send_message',
            data: {
              recipient_id: activeConversation.id,
              content: textToSend,
              message_type: 'text',
            },
          })
        );
      } catch (wsErr) {}
    }

    // 2. Persist to REST API for guaranteed delivery & database sync
    try {
      const res = await api.post('/chat/messages', {
        recipient_id: activeConversation.id,
        content: textToSend,
        message_type: 'text',
      });

      if (res.data?.success && res.data?.data) {
        const created = res.data.data;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConversation.id) {
              const updatedMsgs = c.messages.map((m) => (m.id === tempId ? { ...m, id: created.id, readStatus: 'delivered' as const } : m));
              return {
                ...c,
                messages: updatedMsgs,
              };
            }
            return c;
          })
        );
      }
    } catch (err: any) {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        toast('Message Failed', err.response?.data?.error?.message || 'Could not deliver message to server', 'error');
      }
    }
  };

  // Attachment Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/chat/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const attachmentData = uploadRes.data.data;
      await api.post('/chat/messages', {
        recipient_id: activeConversation.id,
        content: `Attached File: ${file.name}`,
        message_type: 'file',
        attachment_url: attachmentData.attachment_url,
        attachment_name: attachmentData.attachment_name,
        attachment_type: attachmentData.attachment_type,
        attachment_size: attachmentData.attachment_size,
      });

      toast('Attachment Sent', `Uploaded ${file.name} successfully.`, 'success');
    } catch (err: any) {
      toast('Upload Failed', err.response?.data?.error?.message || 'Failed to upload attachment', 'error');
    }
  };

  return (
    <MainLayout clientName={isClientRole ? 'Client Support' : 'All Accounts'} pageTitle="Realtime Chat">
      <div className="h-[calc(100vh-140px)] h-[calc(100dvh-140px)] bg-white border border-[#E3E8E3] rounded-[24px] shadow-[0_8px_30px_rgba(47,79,58,.06)] overflow-hidden flex flex-col md:flex-row">
        {/* Left Sidebar: Conversations Directory */}
        <div
          className={cn(
            'w-full md:w-[340px] border-r border-[#E3E8E3] bg-[#F9FAF9] flex flex-col shrink-0 transition-all duration-200',
            showMobileChat ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Header & Connection Badge */}
          <div className="p-4 border-b border-[#E3E8E3] space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center font-bold shadow-xs">
                  <MessageSquare className="w-4 h-4 text-[#DCE9DE]" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#27332B]">Client Messages</h2>
                  <p className="text-[10px] text-[#6B7280] font-medium">Full-Duplex Support Desk</p>
                </div>
              </div>

              {/* WebSocket Status Indicator */}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border',
                  wsStatus === 'connected' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  wsStatus === 'connecting' && 'bg-amber-50 text-amber-700 border-amber-200',
                  (wsStatus === 'disconnected' || wsStatus === 'error') && 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                {wsStatus === 'connected' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Realtime</span>
                  </>
                ) : wsStatus === 'connecting' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                    <span>Connecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-slate-500" />
                    <span>Polling</span>
                  </>
                )}
              </div>
            </div>

            {/* Search Input */}
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-[#6B7280]" />}
              className="bg-[#F7F9F6] border-[#E3E8E3] text-xs h-9"
            />
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E3E8E3]/60">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7280]">
                No active conversations found.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeChatId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setActiveChatId(conv.id);
                      setShowMobileChat(true);
                      setConversations((prev) =>
                        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
                      );
                    }}
                    className={cn(
                      'w-full p-3.5 text-left flex items-start gap-3 transition-colors relative hover:bg-white',
                      isActive ? 'bg-white border-l-4 border-l-[#2F4F3A] shadow-2xs' : 'bg-transparent'
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-[#2F4F3A] text-[#DCE9DE] font-bold text-xs flex items-center justify-center shadow-2xs">
                        {conv.initials}
                      </div>
                      {conv.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#27332B] truncate">{conv.name}</span>
                        <span className="text-[10px] text-[#6B7280] font-medium shrink-0">{conv.lastMessageTime}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-[#5E8C61] truncate mt-0.5">{conv.companyName}</p>
                      <p className="text-[11px] text-[#6B7280] truncate mt-0.5">{conv.lastMessage}</p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="bg-[#4CAF50] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Chat Panel */}
        <div
          className={cn(
            'flex-1 flex flex-col bg-white overflow-hidden',
            !showMobileChat ? 'hidden md:flex' : 'flex'
          )}
        >
          {activeConversation ? (
            <>
              {/* Chat Top Banner */}
              <div className="p-3.5 px-5 border-b border-[#E3E8E3] flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1 text-[#27332B] hover:bg-[#EEF5EF] rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-[#2F4F3A] text-[#DCE9DE] font-bold text-xs flex items-center justify-center shadow-xs">
                      {activeConversation.initials}
                    </div>
                    {activeConversation.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-[#27332B]">{activeConversation.name}</h3>
                    <p className="text-[11px] font-semibold text-[#5E8C61]">
                      {activeConversation.role} • {activeConversation.companyName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isClientRole && (
                    <button
                      type="button"
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition-all text-xs font-bold shadow-xs cursor-pointer"
                      title="Manage WhatsApp Web Integration"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>WhatsApp Web</span>
                    </button>
                  )}
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EEF5EF] text-[#2F4F3A] border border-[#D7DDD7]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Encrypted Portal Channel
                  </span>
                </div>
              </div>

              {/* Chat Message Scroll Box */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F9FAF9]">
                {activeConversation.messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#6B7280]">
                    No messages yet. Send a message to start the conversation!
                  </div>
                ) : (
                  activeConversation.messages.map((msg) => {
                    const isMe = msg.sender === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={cn('flex flex-col max-w-[85%] sm:max-w-[70%]', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#6B7280] font-semibold">
                          <span>{msg.senderName}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          className={cn(
                            'p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs',
                            isMe
                              ? 'bg-[#2F4F3A] text-white rounded-tr-xs font-medium'
                              : 'bg-white border border-[#E3E8E3] text-[#27332B] rounded-tl-xs font-medium'
                          )}
                        >
                          {msg.text}

                          {msg.attachment && (
                            <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center gap-2">
                              <FileText className="w-4 h-4 shrink-0" />
                              <span className="font-bold truncate">{msg.attachment.name}</span>
                              <span className="text-[10px] opacity-80 shrink-0">({msg.attachment.size})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Input Box */}
              <form onSubmit={handleSendMessage} className="p-3.5 border-t border-[#E3E8E3] bg-white flex items-center gap-2 shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-[#6B7280] hover:text-[#2F4F3A] hover:bg-[#EEF5EF] rounded-xl transition-colors shrink-0"
                  title="Attach File"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <Input
                  placeholder="Type your message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="bg-[#F7F9F6] border-[#E3E8E3] text-xs h-10 rounded-xl"
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white h-10 px-4 rounded-xl shrink-0 text-xs font-bold"
                  rightIcon={<Send className="w-4 h-4" />}
                >
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-[#6B7280]">
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>

      {!isClientRole && (
        <WhatsAppConnectModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
        />
      )}
    </MainLayout>
  );
};
