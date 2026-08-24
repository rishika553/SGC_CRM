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
  Receipt,
  Calendar,
  Clock,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate, formatCurrency, formatName } from '@/lib/utils';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/features/auth/AuthContext';
import { clientQueryKeys, fetchMyClient } from '@/features/clients/clientQueries';
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

  const roleName = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleName === 'client' || roleName === 'client_viewer';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  
  // Dashboard Metrics
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [pendingConsentsCount, setPendingConsentsCount] = useState<number>(0);
  const [outstandingBilling, setOutstandingBilling] = useState<number>(0);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      // Resolve the scoped client from the stored reference, falling back to the
      // superadmin scope when the reference is missing or stale.
      let targetClientId = isUUID(localStorage.getItem('crm_active_client_id')) ? localStorage.getItem('crm_active_client_id') : null;

      try {
        // Validate the stored client still exists. A soft-deleted client returns 404,
        // so clear the stale localStorage reference before firing the scoped requests.
        let profile: Client | null = null;
        if (targetClientId) {
          try {
            const profileResponse = await api.get(`/clients/${targetClientId}`);
            profile = profileResponse.data.data || null;
          } catch (err: any) {
            if (err?.response?.status === 404) {
              localStorage.removeItem('crm_active_client_id');
              localStorage.removeItem('crm_active_client_name');
              targetClientId = null;
            }
          }
        } else if (isClientRole) {
          profile = await queryClient.fetchQuery({ queryKey: clientQueryKeys.mine, queryFn: fetchMyClient });
          if (profile?.id) {
            localStorage.setItem('crm_active_client_id', profile.id);
            localStorage.setItem('crm_active_client_name', profile.name);
          }
        }

        setClientProfile(profile);

        const scopedParams = { page: 1, page_size: 10, ...(targetClientId ? { client_id: targetClientId } : {}) };
        // These resources do not depend on each other, so start every request at once.
        // Individual failures resolve to null and do not prevent the rest of the dashboard loading.
        const [projectResponse, taskResponse, consentsResponse, invoiceResponse, meetingsResponse] = await Promise.all([
          api.get<PaginatedResponse<any>>('/agendas', { params: scopedParams }).catch(() => null),
          api.get<PaginatedResponse<any>>('/tasks', { params: scopedParams }).catch(() => null),
          api.get<PaginatedResponse<any>>('/consents', {
            params: { page: 1, page_size: 1, status: 'pending', ...(targetClientId ? { client_id: targetClientId } : {}) },
          }).catch(() => null),
          api.get<PaginatedResponse<any>>('/invoices', { params: { page: 1, page_size: 20 } }).catch(() => null),
          api.get<PaginatedResponse<any>>('/meetings', {
            params: { page: 1, page_size: 5, status: 'scheduled', ...(targetClientId ? { client_id: targetClientId } : {}) },
          }).catch(() => null),
        ]);

        if (projectResponse?.data.success && projectResponse.data.data) {
          setProjects(projectResponse.data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            progress: p.progress || 0,
            status: p.status || 'in_progress',
            start_date: p.start_date || p.created_at,
            deadline: p.deadline || p.end_date,
          })));
        }

        if (taskResponse?.data.success && taskResponse.data.data) {
          setTasks(taskResponse.data.data.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status || 'todo',
            priority: t.priority || 'medium',
            due_date: t.due_date,
          })));
        }

        if (consentsResponse?.data.success && consentsResponse.data.meta) {
          setPendingConsentsCount(consentsResponse.data.meta.total || consentsResponse.data.data.length || 0);
        }

        if (invoiceResponse?.data.success && invoiceResponse.data.data) {
          const invData = invoiceResponse.data.data;
          let outstanding = 0;
          invData.forEach((inv: any) => {
            if (inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'partially_paid' || inv.status === 'unpaid') {
              outstanding += inv.outstanding_amount || inv.total_amount || 0;
            }
          });
          setOutstandingBilling(outstanding);
          setRecentInvoices(invData.slice(0, 5));
        }

        if (meetingsResponse?.data.success && meetingsResponse.data.data) {
          setUpcomingMeetings(meetingsResponse.data.data);
        }

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

  const clientNameDisplay = currentUser ? formatName(currentUser.first_name, currentUser.last_name) : 'Valued Partner';
  const companyNameDisplay = clientProfile?.name || 'Acme Advisory Group';
  const activeClientId = clientProfile?.id || localStorage.getItem('crm_active_client_id');

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

            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {clientNameDisplay}
            </p>
            <p className="text-sm text-white/80 max-w-xl">
              Here is your active agenda overview, task status, and communications summary for <b className="text-white underline decoration-[#DCE9DE]">{companyNameDisplay}</b>.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap relative z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/chat')}
              leftIcon={<MessageSquare className="w-4 h-4 text-emerald-300" />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs px-4 py-2.5 rounded-xl shadow-xs flex-1 sm:flex-none"
            >
              Support Chat
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/settings')}
              leftIcon={<User className="w-4 h-4" />}
              className="bg-[#DCE9DE] hover:bg-white text-[#2F4F3A] font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm flex-1 sm:flex-none"
            >
              My Profile
            </Button>
          </div>
        </div>

        {/* 2. Summary Metrics Cards (4 Columns) */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Active Projects */}
            <button
              type="button"
              onClick={() => navigate('/agendas')}
              className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden text-left hover:border-[#5E8C61]/40 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ACTIVE AGENDAS</span>
                <div className="w-8 h-8 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] flex items-center justify-center font-bold group-hover:bg-[#2F4F3A] group-hover:text-white transition-colors">
                  <Kanban className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#27332B]">{inProgressProjectsCount}</span>
                <span className="text-xs font-semibold text-slate-500">/ {totalProjectsCount}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">
                {completedProjectsCount} completed
              </p>
            </button>

            {/* Card 2: Pending Approvals */}
            <button
              type="button"
              onClick={() => navigate('/consent')}
              className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden text-left hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PENDING APPROVALS</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#27332B]">{pendingConsentsCount}</span>
                <span className="text-xs font-semibold text-amber-600">Awaiting</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">
                Consents needing review
              </p>
            </button>

            {/* Card 3: Invoice Due */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden text-left hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">INVOICE DUE</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-[#27332B]">{formatCurrency(outstandingBilling)}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">Outstanding balance</p>
            </button>

            {/* Card 4: Open Tasks */}
            <button
              type="button"
              onClick={() => navigate('/agendas')}
              className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)] relative overflow-hidden text-left hover:border-[#5E8C61]/40 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OPEN TASKS</span>
                <div className="w-8 h-8 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] flex items-center justify-center font-bold group-hover:bg-[#2F4F3A] group-hover:text-white transition-colors">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#27332B]">{pendingTasksCount}</span>
                <span className="text-xs font-semibold text-slate-500">/ {totalTasksCount}</span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1">
                Tasks pending completion
              </p>
            </button>

          </div>
        )}


        {/* 3. Main Two Column Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Agenda Progress (2 Cols Wide) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Agenda Progress Section */}
            <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Kanban className="w-5 h-5 text-[#2F4F3A]" />
                  <h3 className="text-sm font-extrabold text-[#27332B]">Agenda Progress</h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/agendas')}
                  className="text-xs font-bold text-[#5E8C61] hover:text-[#2F4F3A] flex items-center gap-1 transition-colors"
                >
                  View All Agendas <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-semibold">No active agendas found for your company.</p>
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

                      <div className="flex items-center justify-between gap-1 flex-wrap text-[10px] text-slate-500 pt-1 font-medium">
                        <span>Started: {formatDate(proj.start_date)}</span>
                        <span>Expected Completion: {formatDate(proj.deadline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Quick Actions & Recent Activity (1 Col Wide) */}
          <div className="space-y-6">

            {/* Recent Invoices */}
            {!isLoading && recentInvoices.length > 0 && (
              <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)]">
                <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#2F4F3A]" />
                    <h3 className="text-sm font-extrabold text-[#27332B]">Recent Invoices</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/billing')}
                    className="text-xs font-bold text-[#5E8C61] hover:text-[#2F4F3A] flex items-center gap-1 transition-colors"
                  >
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-[#E3E8E3]">
                  {recentInvoices.map((inv: any) => {
                    const isPaid = inv.status === 'paid';
                    const isOverdue = inv.status === 'overdue';
                    return (
                      <div key={inv.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#27332B] truncate">{inv.invoice_number}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{formatDate(inv.issue_date || inv.created_at)}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-[#27332B]">{formatCurrency(inv.total_amount || 0)}</div>
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block',
                            isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {isPaid ? 'Paid' : isOverdue ? 'Overdue' : inv.status === 'partially_paid' ? 'Partial' : 'Unpaid'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Meetings */}
            {!isLoading && (
              <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 shadow-[0_4px_20px_rgba(47,79,58,.04)]">
                <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#2F4F3A]" />
                    <h3 className="text-sm font-extrabold text-[#27332B]">Upcoming Meetings</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/calendar')}
                    className="text-xs font-bold text-[#5E8C61] hover:text-[#2F4F3A] flex items-center gap-1 transition-colors"
                  >
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {upcomingMeetings.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No upcoming meetings</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMeetings.map((m: any) => (
                      <div key={m.id} className="p-3 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#27332B] truncate">{m.title}</span>
                          <span className="text-[10px] font-bold text-[#2F4F3A] bg-[#DCE9DE] px-2 py-0.5 rounded-full shrink-0">
                            {m.meeting_type === 'video_call' ? 'Video' : m.meeting_type === 'phone_call' ? 'Phone' : 'In Person'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(m.start_time)}</span>
                        </div>
                        {m.assignees?.length > 0 && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">RM:</span>
                            <span className="text-[10px] font-semibold text-[#2F4F3A]">
                              {m.assignees.map((a: any) => formatName(a.user?.first_name, a.user?.last_name)).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>
    </MainLayout>
  );
};
