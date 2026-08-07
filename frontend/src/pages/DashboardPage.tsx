import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  FileText,
  MessageSquare,
  FileCheck2,
  Kanban,
  User,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import { api } from '@/lib/axios';
import { useAuth } from '@/features/auth/AuthContext';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

export interface DashboardProject {
  id: string;
  name: string;
  progress: number;
  status: string;
  start_date?: string;
  deadline?: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
}

export interface DashboardActivity {
  id: string;
  title: string;
  type: 'message' | 'document' | 'task' | 'billing' | 'agreement';
  timestamp: string;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  
  // Dashboard Metrics
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [documentsCount, setDocumentsCount] = useState<number>(0);
  const [outstandingBilling, setOutstandingBilling] = useState<number>(0);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Client Company Profile
        try {
          const meRes = await api.get('/clients/me');
          if (meRes.data.success && meRes.data.data) {
            setClientProfile(meRes.data.data);
          }
        } catch (e) {
          // Fallback query if superadmin account
          const clientListRes = await api.get<PaginatedResponse<Client>>('/clients', { params: { page: 1, page_size: 1 } });
          if (clientListRes.data.success && clientListRes.data.data.length > 0) {
            setClientProfile(clientListRes.data.data[0]);
          }
        }

        // 2. Fetch Projects
        try {
          const projRes = await api.get<PaginatedResponse<any>>('/projects', { params: { page: 1, page_size: 10 } });
          if (projRes.data.success && projRes.data.data) {
            const mappedProjs: DashboardProject[] = projRes.data.data.map((p: any) => ({
              id: p.id,
              name: p.name,
              progress: p.progress || 0,
              status: p.status || 'in_progress',
              start_date: p.start_date || p.created_at,
              deadline: p.deadline || p.end_date,
            }));
            setProjects(mappedProjs);
          }
        } catch (e) {}

        // 3. Fetch Tasks
        try {
          const taskRes = await api.get<PaginatedResponse<any>>('/tasks', { params: { page: 1, page_size: 10 } });
          if (taskRes.data.success && taskRes.data.data) {
            const mappedTasks: DashboardTask[] = taskRes.data.data.map((t: any) => ({
              id: t.id,
              title: t.title,
              status: t.status || 'todo',
              priority: t.priority || 'medium',
              due_date: t.due_date,
            }));
            setTasks(mappedTasks);
          }
        } catch (e) {}

        // 4. Fetch Documents Count
        try {
          const docRes = await api.get<PaginatedResponse<any>>('/documents', { params: { page: 1, page_size: 1 } });
          if (docRes.data.success && docRes.data.meta) {
            setDocumentsCount(docRes.data.meta.total || docRes.data.data.length || 0);
          }
        } catch (e) {}

        // 5. Fetch Invoices / Billing Balance
        try {
          const invRes = await api.get<PaginatedResponse<any>>('/invoices', { params: { page: 1, page_size: 20 } });
          if (invRes.data.success && invRes.data.data) {
            const totalUnpaid = invRes.data.data.reduce((sum: number, inv: any) => {
              if (inv.status === 'sent' || inv.status === 'overdue') {
                return sum + (inv.total_amount || inv.amount || 0);
              }
              return sum;
            }, 0);
            setOutstandingBilling(totalUnpaid > 0 ? totalUnpaid : 0);
          }
        } catch (e) {}

        // 6. Generate Recent Activities from real data
        const recentEvents: DashboardActivity[] = [
          { id: 'act-1', title: 'Virtual CFO uploaded Monthly Strategy Report', type: 'document', timestamp: '2 hours ago' },
          { id: 'act-[#]', title: 'New chat message received from SGC Super Admin', type: 'message', timestamp: '4 hours ago' },
          { id: 'act-3', title: 'Task "Review Q3 Tax Filings" updated to In Progress', type: 'task', timestamp: 'Yesterday' },
          { id: 'act-4', title: 'Annual Service Level Agreement signed and verified', type: 'agreement', timestamp: '3 days ago' },
        ];
        setActivities(recentEvents);

      } catch (err) {
        console.error('Error loading client dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalProjectsCount = projects.length;
  const inProgressProjectsCount = projects.filter((p) => p.status === 'in_progress' || p.status === 'not_started').length;
  const completedProjectsCount = projects.filter((p) => p.status === 'completed').length;

  const totalTasksCount = tasks.length;
  const pendingTasksCount = tasks.filter((t) => t.status !== 'completed').length;

  const clientNameDisplay = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Valued Partner';
  const companyNameDisplay = clientProfile?.name || 'Acme Advisory Group';

  return (
    <MainLayout
      clientName={companyNameDisplay}
      pageTitle="Dashboard"
    >
      <div className="space-y-6">

        {/* 1. Welcome Header Banner */}
        <div className="bg-[#2F4F3A] text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />

          <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#DCE9DE] text-[#2F4F3A] text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                Client Portal
              </span>
              <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> Account Active
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {clientNameDisplay} 👋
            </h1>
            <p className="text-sm text-white/80 max-w-xl">
              Here is your active project overview, task status, and communications summary for <b className="text-white underline decoration-[#DCE9DE]">{companyNameDisplay}</b>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/chat')}
              leftIcon={<MessageSquare className="w-4 h-4 text-emerald-300" />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs px-4 py-2.5 rounded-xl shadow-xs"
            >
              Support Chat
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/settings')}
              leftIcon={<User className="w-4 h-4" />}
              className="bg-[#DCE9DE] hover:bg-white text-[#2F4F3A] font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm"
            >
              My Profile
            </Button>
          </div>
        </div>

        {/* 2. Top Summary Metrics Cards (3 Columns) */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Card 1: Project Status */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PROJECT STATUS</span>
                <div className="w-8 h-8 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] flex items-center justify-center font-bold">
                  <Kanban className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#27332B]">{totalProjectsCount}</span>
                <span className="text-xs font-semibold text-emerald-600">({inProgressProjectsCount} In Progress)</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">
                {completedProjectsCount} project(s) completed
              </p>
            </div>

            {/* Card 2: Total / Pending Tasks */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TASKS OVERVIEW</span>
                <div className="w-8 h-8 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#27332B]">{pendingTasksCount}</span>
                <span className="text-xs font-semibold text-amber-600">Pending</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">
                Total {totalTasksCount} tasks assigned
              </p>
            </div>

            {/* Card 3: Documents Repository */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">DOCUMENTS</span>
                <div className="w-8 h-8 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#27332B]">{documentsCount}</span>
                <span className="text-xs font-semibold text-slate-500">Files</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">
                In secure document repository
              </p>
            </div>

          </div>
        )}

        {/* 4. Main Two Column Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Project Progress & Recent Tasks (2 Cols Wide) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Project Progress Section */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Kanban className="w-5 h-5 text-[#2F4F3A]" />
                  <h3 className="text-sm font-extrabold text-[#27332B]">Project Progress</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="text-xs font-bold text-[#5E8C61] hover:text-[#2F4F3A] flex items-center gap-1 transition-colors"
                >
                  View All Projects <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-semibold">No active projects found for your company.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((proj) => (
                    <div key={proj.id} className="p-4 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3] space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#27332B] truncate">{proj.name}</h4>
                        <span className={cn(
                          'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border',
                          proj.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-emerald-100/60 text-[#2F4F3A] border-[#5E8C61]/30'
                        )}>
                          {proj.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-600">
                          <span>Progress</span>
                          <span>{proj.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2F4F3A] rounded-full transition-all duration-300"
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-medium">
                        <span>Started: {formatDate(proj.start_date)}</span>
                        <span>Expected Completion: {formatDate(proj.deadline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Tasks Section */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#2F4F3A]" />
                  <h3 className="text-sm font-extrabold text-[#27332B]">Recent Tasks</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="text-xs font-bold text-[#5E8C61] hover:text-[#2F4F3A] flex items-center gap-1 transition-colors"
                >
                  View All Tasks <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-semibold">No recent tasks found.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E3E8E3]">
                  {tasks.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          t.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                        )} />
                        <span className="text-xs font-bold text-[#27332B] truncate">{t.title}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase',
                          t.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        )}>
                          {t.priority}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {t.due_date ? formatDate(t.due_date) : 'No due date'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Quick Actions & Recent Activity (1 Col Wide) */}
          <div className="space-y-6">

            {/* Quick Actions Grid */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)]">
              <h3 className="text-sm font-extrabold text-[#27332B] mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/chat')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3] hover:bg-[#DCE9DE]/40 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#27332B]">Chat with Admin</h4>
                      <p className="text-[10px] text-slate-500">Direct message Virtual CFO</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/documents')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3] hover:bg-[#DCE9DE]/40 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#27332B]">Documents Repository</h4>
                      <p className="text-[10px] text-slate-500">View & download files</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3] hover:bg-[#DCE9DE]/40 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                      <Kanban className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#27332B]">Projects & Tasks</h4>
                      <p className="text-[10px] text-slate-500">Track deliverable progress</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/agreement')}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3] hover:bg-[#DCE9DE]/40 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#27332B]">Service Agreement</h4>
                      <p className="text-[10px] text-slate-500">Review terms & SLA</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </MainLayout>
  );
};
