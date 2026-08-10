import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  User as UserIcon,
  FileCheck2,
  Kanban,
  Receipt,
  FileText,
  MessageSquare,
  Settings,
  ChevronDown,
  Building2,
  Plus,
  Check,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  Shield,
  MessageCircle,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { api } from '@/lib/axios';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';
import { useAuth } from '@/features/auth/AuthContext';

export interface ClientOption {
  id: string;
  name: string;
  code?: string;
}

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  clients?: ClientOption[];
  activeClient?: ClientOption | null;
  onSelectClient?: (client: ClientOption) => void;
  onAddClient?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  clients: initialClients,
  activeClient: initialActiveClient,
  onSelectClient,
  onAddClient,
}) => {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const SUPERADMIN_OPTION: ClientOption = { id: 'superadmin', name: 'Superadmin Main View' };
  const [liveClients, setLiveClients] = useState<ClientOption[]>(initialClients || []);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(initialActiveClient || SUPERADMIN_OPTION);

  const { user: currentUser } = useAuth();
  const roleName = currentUser?.role?.name ? String(currentUser.role.name).toLowerCase() : '';
  const isClientRole = roleName === 'client' || roleName === 'client_viewer';

  React.useEffect(() => {
    if (initialActiveClient) {
      setSelectedClient(initialActiveClient);
    }
  }, [initialActiveClient]);

  React.useEffect(() => {
    const pathname = window.location.pathname;
    const urlClientId = pathname.includes('/clients/') ? pathname.split('/clients/')[1]?.split('/')[0] : null;
    const savedClientId = localStorage.getItem('crm_active_client_id');

    if (initialClients && initialClients.length > 0) {
      setLiveClients(initialClients);
      if (initialActiveClient) {
        setSelectedClient(initialActiveClient);
      } else if (urlClientId) {
        const matched = initialClients.find((c) => c.id === urlClientId);
        if (matched) setSelectedClient(matched);
        else setSelectedClient(SUPERADMIN_OPTION);
      } else if (savedClientId && savedClientId !== 'superadmin') {
        const matched = initialClients.find((c) => c.id === savedClientId);
        if (matched) setSelectedClient(matched);
        else setSelectedClient(SUPERADMIN_OPTION);
      } else {
        setSelectedClient(SUPERADMIN_OPTION);
      }
      return;
    }

    const fetchLiveClients = async () => {
      if (isClientRole) return;
      try {
        const response = await api.get<PaginatedResponse<Client>>('/clients', { params: { page: 1, page_size: 50 } });
        if (response.data.success && response.data.data.length > 0) {
          const formatted = response.data.data.map((c) => ({
            id: c.id,
            name: c.name,
          }));
          setLiveClients(formatted);

          if (initialActiveClient) {
            setSelectedClient(initialActiveClient);
          } else if (urlClientId) {
            const matched = formatted.find((c) => c.id === urlClientId);
            if (matched) {
              setSelectedClient(matched);
            } else {
              setSelectedClient(SUPERADMIN_OPTION);
            }
          } else if (savedClientId && savedClientId !== 'superadmin') {
            const matched = formatted.find((c) => c.id === savedClientId);
            if (matched) {
              setSelectedClient(matched);
            } else {
              setSelectedClient(SUPERADMIN_OPTION);
            }
          } else {
            setSelectedClient(SUPERADMIN_OPTION);
          }
        }
      } catch (err) {
        // Fallback gracefully on network error
      }
    };

    fetchLiveClients();
  }, [initialClients, initialActiveClient, isClientRole]);

  const adminNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Building2 className="w-5 h-5 shrink-0" /> },
    { label: 'Clients', path: '/clients', icon: <UserIcon className="w-5 h-5 shrink-0" /> },
    { label: 'Projects & Tasks', path: '/projects', icon: <Kanban className="w-5 h-5 shrink-0" /> },
    { label: 'Agreement', path: '/agreement', icon: <FileCheck2 className="w-5 h-5 shrink-0" /> },
    { label: 'Consent', path: '/consent', icon: <ClipboardCheck className="w-5 h-5 shrink-0" /> },
    { label: 'Billing / Ledger', path: '/billing', icon: <Receipt className="w-5 h-5 shrink-0" /> },
    { label: 'Documents', path: '/documents', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { label: 'User Management', path: '/users', icon: <Shield className="w-5 h-5 shrink-0" /> },
    { label: 'Chat', path: '/chat', icon: <MessageSquare className="w-5 h-5 shrink-0" /> },
    { label: 'WhatsApp', path: '/whatsapp', icon: <MessageCircle className="w-5 h-5 shrink-0 text-[#25D366]" /> },
  ];

  const clientNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Building2 className="w-5 h-5 shrink-0" /> },
    { label: 'Agreement', path: '/agreement', icon: <FileCheck2 className="w-5 h-5 shrink-0" /> },
    { label: 'Consent', path: '/consent', icon: <ClipboardCheck className="w-5 h-5 shrink-0" /> },
    { label: 'Projects & Tasks', path: '/projects', icon: <Kanban className="w-5 h-5 shrink-0" /> },
    { label: 'Documents', path: '/documents', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { label: 'Chat', path: '/chat', icon: <MessageSquare className="w-5 h-5 shrink-0" /> },
  ];

  const topNavItems = isClientRole ? clientNavItems : adminNavItems;

  const handleClientSelect = (client: ClientOption) => {
    setSelectedClient(client);
    if (client.id === 'superadmin') {
      localStorage.setItem('crm_active_client_id', 'superadmin');
      localStorage.setItem('crm_active_client_name', 'Superadmin Main View');
    } else {
      localStorage.setItem('crm_active_client_id', client.id);
      localStorage.setItem('crm_active_client_name', client.name);
    }

    if (onSelectClient) {
      onSelectClient(client);
    } else {
      if (client.id === 'superadmin') {
        window.location.href = '/dashboard';
      } else {
        window.location.href = `/clients/${client.id}`;
      }
    }
    setIsClientDropdownOpen(false);
  };

  const sidebarWidthClass = isCollapsed ? 'md:w-[72px] w-[280px]' : 'w-[280px] md:w-[260px]';

  const sidebarContent = (
    <div
      className={cn(
        'bg-[#2F4F3A] text-white flex flex-col h-full overflow-hidden select-none transition-all duration-300 ease-in-out shadow-lg max-w-[85vw]',
        sidebarWidthClass
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[#DCE9DE] flex items-center justify-center text-[#2F4F3A] font-extrabold text-sm shadow-md shrink-0">
            S
          </div>
          {!isCollapsed && (
            <span className="text-base font-bold text-white tracking-tight whitespace-nowrap animate-in fade-in duration-200">
              SGC CRM
            </span>
          )}
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="md:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="hidden md:flex p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          )
        )}
      </div>

      {/* Main Navigation Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Client Selector Dropdown (Shown only for Admin Accounts) */}
          {!isClientRole && (
            <div className="relative">
              {!isCollapsed && (
                <div className="text-[10px] uppercase font-bold tracking-wider text-white/60 px-1 mb-1.5 animate-in fade-in duration-200">
                  Client Account
                </div>
              )}

            <button
              type="button"
              onClick={() => setIsClientDropdownOpen((prev) => !prev)}
              title={isCollapsed ? (selectedClient ? selectedClient.name : 'Select Client') : undefined}
              className={cn(
                'w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.08] border border-white/15 hover:bg-white/[0.14] text-left transition-all',
                isCollapsed && 'justify-center p-2'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#DCE9DE]/20 text-[#DCE9DE] font-bold text-xs flex items-center justify-center shrink-0">
                  {selectedClient?.id === 'superadmin' ? <Crown className="w-3.5 h-3.5 text-amber-300" /> : <Building2 className="w-3.5 h-3.5" />}
                </div>
                {!isCollapsed && (
                  <span className="text-sm font-semibold text-white truncate">
                    {selectedClient ? selectedClient.name : 'Select Client'}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <ChevronDown className={cn("w-4 h-4 text-white/70 shrink-0 transition-transform duration-200", isClientDropdownOpen && "rotate-180")} />
              )}
            </button>

            {/* Client Dropdown Popup */}
            {isClientDropdownOpen && (
              <div
                className={cn(
                  'absolute top-full mt-1.5 bg-[#25402F] border border-white/20 rounded-xl shadow-2xl p-1.5 z-50 space-y-1',
                  isCollapsed ? 'left-14 w-60' : 'left-0 right-0'
                )}
              >
                {/* Return to Superadmin Account Option */}
                {!isClientRole && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const superadminOpt = { id: 'superadmin', name: 'Superadmin Account' };
                        setSelectedClient(superadminOpt);
                        if (onSelectClient) onSelectClient(superadminOpt);
                        else window.location.href = '/dashboard';
                        setIsClientDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-bold transition-colors border mb-1",
                        selectedClient?.id === 'superadmin'
                          ? "bg-amber-400/25 text-amber-200 border-amber-400/50 shadow-xs"
                          : "text-amber-300 border-amber-400/30 hover:bg-amber-400/10"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Superadmin Account</span>
                      </div>
                      {selectedClient?.id === 'superadmin' && <Check className="w-3.5 h-3.5 shrink-0 text-amber-300" />}
                    </button>
                    <div className="border-t border-white/10 my-1" />
                  </>
                )}

                {liveClients.length === 0 ? (
                  <div className="p-2 text-xs text-white/70 text-center">No clients found</div>
                ) : (
                  liveClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClientSelect(c)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-medium transition-colors",
                        selectedClient?.id === c.id
                          ? "bg-[#DCE9DE] text-[#2F4F3A] font-bold shadow-xs"
                          : "text-white/90 hover:bg-white/[0.08] hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 opacity-80" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {selectedClient?.id === c.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))
                )}

                <div className="border-t border-white/10 pt-1 mt-1" />
                <button
                  type="button"
                  onClick={() => {
                    if (onAddClient) onAddClient();
                    else window.location.href = '/clients';
                    setIsClientDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-semibold text-[#DCE9DE] hover:bg-white/[0.08] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Client</span>
                </button>
              </div>
            )}
          </div>
        )}

          {/* Top Section Nav Items */}
          <nav className="space-y-1">
            {topNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 relative group',
                    isCollapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-[#DCE9DE] text-[#2F4F3A] font-bold shadow-md'
                      : 'text-white/90 hover:bg-white/[0.08] hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-[#2F4F3A]" />
                    )}
                    <span>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Section with Settings & User Profile */}
        <div>
          <div className="border-t border-white/10 my-3" />
          <NavLink
            to="/settings"
            onClick={onClose}
            title={isCollapsed ? 'Settings' : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150',
                isCollapsed && 'justify-center px-2',
                isActive
                  ? 'bg-[#DCE9DE] text-[#2F4F3A] font-bold shadow-md'
                  : 'text-white/90 hover:bg-white/[0.08] hover:text-white'
              )
            }
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </NavLink>

          {/* User Profile Section at Bottom */}
          {(() => {
            const { user } = useAuth();
            const userInitials = user ? `${user.first_name[0]}${user.last_name[0]}` : 'U';
            const userName = user ? `${user.first_name} ${user.last_name}` : 'User Account';
            const userRole = user?.role?.display_name || user?.role?.name || 'Portal User';

            return (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#DCE9DE] text-[#2F4F3A] font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {userInitials}
                  </div>
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{userName}</div>
                      <div className="text-[10px] text-white/70 truncate">{userRole}</div>
                    </div>
                  )}
                </div>

                {!isCollapsed && onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-label="Collapse Sidebar"
                    className="hidden md:flex p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:block shrink-0 h-screen sticky top-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay Sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
          <div className="relative z-10 h-full animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
