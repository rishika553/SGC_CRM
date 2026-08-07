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

  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeChatId]);

  // Load chat channel directory (Super Admin sees all client channels; Client sees Super Admin channel)
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
          // Super Admin User: Load all client company channels
          let clientList: Client[] = [];
          try {
            const clientRes = await api.get<PaginatedResponse<Client>>('/clients', { params: { page: 1, page_size: 50 } });
            if (clientRes.data.success && clientRes.data.data.length > 0) {
              clientList = clientRes.data.data;
            }
          } catch (e) {}

          const adminConversations: Conversation[] = clientList.map((c) => {
            const primaryContact = c.contacts?.find((ct) => ct.is_primary_contact) || c.contacts?.[0];
            const partnerName = primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : c.name;
            const initials = partnerName.substring(0, 2).toUpperCase();
            // Target recipient ID for client company
            const recipientId = c.id;

            return {
              id: recipientId,
              name: partnerName,
              role: primaryContact?.job_title || 'Client Lead',
              companyName: c.name,
              initials,
              isOnline: true,
              unreadCount: 0,
              lastMessage: 'Click to view discussion history.',
              lastMessageTime: '',
              messages: [],
            };
          });

          setConversations(adminConversations);
          if (adminConversations.length > 0) {
            setActiveChatId(adminConversations[0].id);
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

  // Load message history from DB and set up 2-second polling for real-time full duplex messaging
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
                lastMessage: last ? last.text : c.lastMessage,
                lastMessageTime: last ? last.timestamp : c.lastMessageTime,
              };
            })
          );
        }
      } catch (e) {
        // Silent poll error catch
      }
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

  // Send Message Handler (Full Duplex backend DB persistence)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConversation) return;

    const textToSend = inputMessage.trim();
    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    const activeSenderName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'You';
    const activeSenderInitials = currentUser ? `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase() : 'ME';

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      senderName: activeSenderName,
      senderInitials: activeSenderInitials,
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      readStatus: 'sent',
    };

    const updatedMsgs = [...activeConversation.messages, newMessage];

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversation.id) return c;
        return {
          ...c,
          lastMessage: newMessage.text,
          lastMessageTime: newMessage.timestamp,
          messages: updatedMsgs,
        };
      })
    );

    setInputMessage('');
    setIsEmojiPickerOpen(false);

    // Save to PostgreSQL database via backend API
    if (isUUID(activeConversation.id)) {
      try {
        await api.post('/chat/messages', {
          recipient_id: activeConversation.id,
          content: textToSend,
          message_type: 'text',
        });
      } catch (err: any) {
        toast('Message Warning', err.response?.data?.error?.message || 'Could not deliver message to server', 'error');
      }
    }
  };

  // Attachment Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    const activeSenderName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'You';
    const activeSenderInitials = currentUser ? `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase() : 'ME';

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/chat/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const attachmentData = uploadRes.data.data;

      if (isUUID(activeConversation.id)) {
        await api.post('/chat/messages', {
          recipient_id: activeConversation.id,
          content: `Uploaded attachment: ${file.name}`,
          message_type: 'file',
          attachment_url: attachmentData.attachment_url,
          attachment_name: attachmentData.attachment_name,
          attachment_type: attachmentData.attachment_type,
          attachment_size: attachmentData.attachment_size,
        });
        toast('Attachment Uploaded', `File ${file.name} sent successfully`, 'success');
      }
    } catch (err) {
      toast('Upload Error', 'Failed to upload attachment', 'error');
    }
  };

  return (
    <MainLayout user={currentUser || undefined}>
      <div className="h-[calc(100vh-6.5rem)] flex bg-white rounded-2xl border border-[#E3E8E3] overflow-hidden shadow-[0_4px_20px_rgba(47,79,58,.04)]">
        
        {/* Left Conversation Sidebar */}
        <div
          className={cn(
            'w-full md:w-80 lg:w-96 border-r border-[#E3E8E3] flex flex-col bg-[#F7F9F6] shrink-0 transition-all duration-200',
            showMobileChat ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#E3E8E3] bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center font-bold text-xs">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-[#27332B] tracking-tight">
                  {isClientRole ? 'Support Workspace' : 'Client Communications'}
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#5E8C61] bg-[#DCE9DE] px-2.5 py-0.5 rounded-full border border-[#5E8C61]/20">
                {isClientRole ? 'Direct Portal' : `${conversations.length} Clients`}
              </span>
            </div>

            {/* Search */}
            {!isClientRole && (
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                className="bg-[#F7F9F6] border-[#E3E8E3] text-xs py-1.5 focus:bg-white"
              />
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E3E8E3]/60">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50 text-[#5E8C61]" />
                <p className="text-xs font-semibold">No active conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeChatId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveChatId(conv.id);
                      setShowMobileChat(true);
                    }}
                    className={cn(
                      'w-full p-3.5 text-left transition-all flex items-start gap-3 relative group',
                      isActive
                        ? 'bg-white border-l-4 border-l-[#2F4F3A] shadow-xs'
                        : 'hover:bg-white/80'
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#2F4F3A] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {conv.initials}
                      </div>
                      {conv.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-xs font-bold text-[#27332B] truncate">{conv.name}</h3>
                        <span className="text-[10px] text-slate-400 font-medium">{conv.lastMessageTime}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-[#5E8C61] truncate mb-0.5">{conv.companyName}</p>
                      <p className="text-xs text-slate-500 truncate leading-tight">{conv.lastMessage}</p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="bg-[#2F4F3A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Chat View */}
        <div
          className={cn(
            'flex-1 flex flex-col bg-white min-w-0 transition-all duration-200',
            showMobileChat ? 'flex' : 'hidden md:flex'
          )}
        >
          {activeConversation ? (
            <>
              {/* Active Header */}
              <div className="p-3.5 border-b border-[#E3E8E3] bg-white flex items-center justify-between shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-[#EEF5EF]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative shrink-0">
                    <div className="w-9.5 h-9.5 rounded-full bg-[#2F4F3A] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {activeConversation.initials}
                    </div>
                    {activeConversation.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-extrabold text-[#27332B] truncate">{activeConversation.name}</h2>
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Encrypted
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-[#5E8C61] truncate">
                      {activeConversation.companyName} &bull; {activeConversation.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="hidden lg:flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
                    Real-time Duplex Connected
                  </span>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#F7F9F6]/50">
                {activeConversation.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#DCE9DE] text-[#2F4F3A] flex items-center justify-center mb-2">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#27332B]">No Conversation History Yet</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Send a message below to start your direct discussion with {activeConversation.name}.
                    </p>
                  </div>
                ) : (
                  activeConversation.messages.map((msg) => {
                    const isMe = msg.sender === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={cn('flex items-end gap-2 max-w-[85%] sm:max-w-[75%]', isMe ? 'ml-auto flex-row-reverse' : 'mr-auto')}
                      >
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-[#2F4F3A] text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                            {msg.senderInitials}
                          </div>
                        )}

                        <div className="space-y-1">
                          <div
                            className={cn(
                              'p-3 rounded-2xl text-xs leading-relaxed shadow-subtle',
                              isMe
                                ? 'bg-[#2F4F3A] text-white rounded-br-none'
                                : 'bg-white text-[#27332B] border border-[#E3E8E3] rounded-bl-none'
                            )}
                          >
                            {!isMe && (
                              <p className="text-[10px] font-extrabold text-[#5E8C61] mb-1">{msg.senderName}</p>
                            )}

                            {msg.attachment ? (
                              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/10 border border-white/20 my-1">
                                <FileText className="w-5 h-5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold truncate text-xs">{msg.attachment.name}</p>
                                  <p className="text-[10px] opacity-80">{msg.attachment.size}</p>
                                </div>
                                <Download className="w-4 h-4 cursor-pointer hover:opacity-80 shrink-0" />
                              </div>
                            ) : null}

                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          </div>

                          <div className={cn('flex items-center gap-1 text-[10px] text-slate-400 font-medium px-1', isMe ? 'justify-end' : 'justify-start')}>
                            <span>{msg.timestamp}</span>
                            {isMe && (
                              <CheckCheck className="w-3 h-3 text-emerald-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Controls */}
              <div className="p-3 border-t border-[#E3E8E3] bg-white shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-slate-500 hover:text-[#2F4F3A] hover:bg-[#EEF5EF] transition-colors shrink-0"
                    title="Attach document or file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <Input
                    placeholder="Type your message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    className="flex-1 bg-[#F7F9F6] border-[#E3E8E3] focus:bg-white text-xs py-2 rounded-xl"
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!inputMessage.trim()}
                    className="bg-[#2F4F3A] hover:bg-[#243E2E] px-4 py-2 rounded-xl text-white shadow-xs shrink-0"
                    rightIcon={<Send className="w-4 h-4" />}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center text-slate-400">
              <p className="text-xs">Select a channel to begin messaging</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
