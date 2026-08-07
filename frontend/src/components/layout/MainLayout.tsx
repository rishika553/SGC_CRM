import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { User } from '@/types';

export interface MainLayoutProps {
  children: React.ReactNode;
  user?: User;
  clientName?: string;
  pageTitle?: string;
  onLogout?: () => void;
  activeClient?: { id: string; name: string } | null;
  onSelectClient?: (client: { id: string; name: string }) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  user,
  clientName = 'Client Desk',
  pageTitle = 'Profile',
  onLogout,
  activeClient,
  onSelectClient,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div className="min-h-screen flex bg-[#F7F9F6] text-[#27332B] font-sans">
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        activeClient={activeClient}
        onSelectClient={onSelectClient}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={user}
          clientName={clientName}
          pageTitle={pageTitle}
          onLogout={onLogout}
          onMenuToggle={() => setIsMobileSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto max-w-full overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
};
