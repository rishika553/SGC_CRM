import React from 'react';
import { Search, Bell, User as UserIcon, LogOut, Menu, Crown } from 'lucide-react';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';
import { useAuth } from '@/features/auth/AuthContext';

export interface HeaderProps {
  user?: {
    first_name: string;
    last_name: string;
    email: string;
    role?: { display_name: string; name?: string };
  };
  clientName?: string;
  pageTitle?: string;
  onLogout?: () => void;
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user: userProp,
  clientName = 'Client Desk',
  pageTitle = 'Profile',
  onLogout,
  onMenuToggle,
}) => {
  const { user: authUser, logout } = useAuth();
  const user = userProp || authUser;
  const userInitials = user ? `${user.first_name[0]}${user.last_name[0]}` : 'U';
  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);

  const roleName = user?.role?.name ? String(user.role.name).toLowerCase() : '';
  const isClientRole = roleName === 'client' || roleName === 'client_viewer';
  const [clientProfileName, setClientProfileName] = React.useState<string>(clientName);

  React.useEffect(() => {
    if (isClientRole) {
      import('@/lib/axios').then(({ api }) => {
        api.get('/clients/me')
          .then((res) => {
            if (res.data.success && res.data.data?.name) {
              setClientProfileName(res.data.data.name);
            }
          })
          .catch(() => {});
      });
    }
  }, [isClientRole]);

  const userMenuItems = [
    ...(!isClientRole ? [{
      id: 'superadmin-account',
      label: 'Superadmin Account View',
      icon: <Crown className="w-4 h-4 text-amber-600" />,
      onClick: () => (window.location.href = '/dashboard'),
    }] : []),
    {
      id: 'profile',
      label: 'My Profile',
      icon: <UserIcon className="w-4 h-4" />,
      onClick: () => (window.location.href = '/settings'),
    },
    {
      id: 'logout',
      label: 'Sign Out',
      icon: <LogOut className="w-4 h-4" />,
      danger: true,
      onClick: () => {
        if (onLogout) onLogout();
        else logout();
      },
    },
  ];

  return (
    <header className="bg-white border-b border-[#E3E8E3] px-3 sm:px-4 md:px-6 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-subtle">
      {/* Left Section: Mobile Menu, Breadcrumb & Title */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-[#EEF5EF] transition-all shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] font-semibold text-[#6B7280] tracking-wide truncate max-w-[130px] sm:max-w-xs md:max-w-none">
            <span>{isClientRole ? clientProfileName : clientName}</span> &nbsp;/&nbsp;{' '}
            <b className="text-[#27332B] font-bold">{pageTitle}</b>
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#27332B] tracking-tight truncate leading-tight mt-0.5">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right Section: Return to Superadmin Button, Search, Notification Bell & User Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Return to Superadmin Account Button for Admins */}
        {!isClientRole && (
          <button
            type="button"
            onClick={() => (window.location.href = '/dashboard')}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition-all text-xs font-bold shadow-2xs shrink-0"
            title="Return to Superadmin Main Account View"
          >
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            <span>Superadmin Account</span>
          </button>
        )}

        {/* Mobile Search Toggle Icon */}
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen((prev) => !prev)}
          className="sm:hidden p-2 rounded-xl text-[#6B7280] hover:text-[#27332B] hover:bg-[#EEF5EF] transition-all"
          aria-label="Toggle Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Desktop Search Bar */}
        <div className="hidden sm:block w-44 md:w-56 lg:w-64">
          <Input
            placeholder="Search... (Cmd+K)"
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            className="bg-[#F7F9F6] border-[#E3E8E3] focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-1.5"
          />
        </div>

        {/* Notification Icon */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 rounded-xl text-[#6B7280] hover:text-[#27332B] hover:bg-[#EEF5EF] transition-all"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#5E8C61] rounded-full ring-2 ring-white" />
        </button>

        <div className="h-6 w-px bg-[#E3E8E3] hidden sm:block" />

        {/* User Avatar & Dropdown */}
        <Dropdown
          trigger={
            <div className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#EEF5EF] transition-all cursor-pointer select-none">
              <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-[#2F4F3A] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                {userInitials}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-[#27332B] leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'Account User'}
                </span>
                <span className="text-[10px] font-medium text-[#6B7280]">
                  {user?.role?.display_name || 'Principal Virtual CFO'}
                </span>
              </div>
            </div>
          }
          items={userMenuItems}
        />
      </div>

      {/* Mobile Search Overlay input */}
      {isMobileSearchOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-[#E3E8E3] p-3 shadow-md z-40 sm:hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            autoFocus
            placeholder="Search CRM..."
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            className="bg-[#F7F9F6] border-[#E3E8E3] focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-2"
          />
        </div>
      )}
    </header>
  );
};
