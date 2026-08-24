import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Calendar,
  KeyRound,
  ShieldCheck,
  Check,
  Lock,
  UserCheck,
  FolderKanban,
  CheckSquare,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Video,
  MapPin as MapPinIcon,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { DeleteClientModal } from './DeleteClientModal';
import { CreateClientUserModal } from './CreateClientUserModal';
import { ClientDetail } from '@/types/client';
import { Consent } from '@/types/consent';
import { formatCurrency, formatDate, formatName } from '@/lib/utils';
import { api } from '@/lib/axios';

export const ClientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const canDelete = user?.role?.name === 'super_admin';

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'consents' | 'meetings'>('projects');

  // Client entity data
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [clientTasks, setClientTasks] = useState<any[]>([]);
  const [clientConsents, setClientConsents] = useState<Consent[]>([]);
  const [clientMeetings, setClientMeetings] = useState<any[]>([]);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isProvisionLoginOpen, setIsProvisionLoginOpen] = useState(false);
  const [isCredentialsExpanded, setIsCredentialsExpanded] = useState(false);

  const fetchClientDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await api.get(`/clients/${id}`);
      if (response.data.success) {
        setClient(response.data.data);
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to load client details', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchClientDetails();
  }, [fetchClientDetails]);

  const fetchClientProjects = useCallback(async () => {
    if (!id) return;
    setLoadingProjects(true);
    try {
      const res = await api.get('/agendas', { params: { client_id: id, page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientProjects(res.data.data);
      }
    } catch { /* silent */ } finally { setLoadingProjects(false); }
  }, [id]);

  const fetchClientTasks = useCallback(async () => {
    if (!id) return;
    setLoadingTasks(true);
    try {
      const res = await api.get('/tasks', { params: { client_id: id, page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientTasks(res.data.data);
      }
    } catch { /* silent */ } finally { setLoadingTasks(false); }
  }, [id]);

  const fetchClientConsents = useCallback(async () => {
    if (!id) return;
    setLoadingConsents(true);
    try {
      const res = await api.get('/consents', { params: { client_id: id, page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientConsents(res.data.data);
      }
    } catch { /* silent */ } finally { setLoadingConsents(false); }
  }, [id]);

  const fetchClientMeetings = useCallback(async () => {
    if (!id) return;
    setLoadingMeetings(true);
    try {
      const res = await api.get('/meetings', { params: { client_id: id, page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientMeetings(res.data.data);
      }
    } catch { /* silent */ } finally { setLoadingMeetings(false); }
  }, [id]);

  const fetchClientInvoices = useCallback(async () => {
    if (!id) return;
    setLoadingInvoices(true);
    try {
      const res = await api.get('/invoices', { params: { client_id: id, page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientInvoices(res.data.data);
      }
    } catch { /* silent */ } finally { setLoadingInvoices(false); }
  }, [id]);

  // Lazy-load tab data on first view
  useEffect(() => {
    if (clientProjects.length === 0 && !loadingProjects) fetchClientProjects();
    if (clientTasks.length === 0 && !loadingTasks) fetchClientTasks();
    if (clientMeetings.length === 0 && !loadingMeetings) fetchClientMeetings();
    if (clientInvoices.length === 0 && !loadingInvoices) fetchClientInvoices();
    if (activeTab === 'consents' && clientConsents.length === 0 && !loadingConsents) fetchClientConsents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Dashboard stats derived from loaded data
  const unpaidInvoices = clientInvoices.filter((inv: any) => inv.status === 'unpaid' || inv.status === 'overdue' || inv.status === 'pending');
  const nextMeeting = clientMeetings
    .filter((m: any) => m.status === 'scheduled' && new Date(m.start_time) >= new Date())
    .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] || null;

  if (isLoading) {
    return (
      <MainLayout user={user || undefined}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!client) {
    return (
      <MainLayout user={user || undefined}>
        <EmptyState
          title="Client Not Found"
          description="The requested company account does not exist or has been removed."
          actionLabel="Back to Directory"
          onAction={() => navigate('/clients')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      user={user || undefined}
      clientName={client.name}
      pageTitle="Profile"
      activeClient={{ id: client.id, name: client.name }}
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={() => navigate('/clients')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-500 hover:text-surface-900 transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Client Directory
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold text-lg flex items-center justify-center border border-brand-200">
                {client.name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-surface-900">{client.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<KeyRound className="w-4 h-4 text-brand-600" />}
              onClick={() => setIsProvisionLoginOpen(true)}
            >
              {client.email ? 'Set / Reset Password' : 'Provision Credentials'}
            </Button>
          </div>
        </div>

        {/* Client Dashboard Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider block">Total Agendas</span>
              <span className="text-lg font-bold text-surface-900">{clientProjects.length}</span>
            </div>
          </Card>

          <Card padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider block">Total Tasks</span>
              <span className="text-lg font-bold text-surface-900">{clientTasks.length}</span>
            </div>
          </Card>

          <Card padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider block">Unpaid Invoices</span>
              <span className="text-lg font-bold text-surface-900">{unpaidInvoices.length}</span>
            </div>
          </Card>

          <Card padding="sm" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider block">Next Meeting</span>
              {nextMeeting ? (
                <span className="text-xs font-bold text-surface-900 block truncate">{formatDate(nextMeeting.start_time)}</span>
              ) : (
                <span className="text-xs text-surface-400 block">None scheduled</span>
              )}
            </div>
          </Card>
        </div>

        {/* Portal Access & Credentials Card — Collapsible */}
        {(() => {
          const clientUsername = client.email || (client.contacts && client.contacts[0]?.email) || '';
          
          const handleCopyPortalInfo = () => {
            if (!clientUsername) {
              setIsProvisionLoginOpen(true);
              return;
            }
            const info = `SGC CRM Portal Credentials for ${client.name}\n----------------------------------------\nClient Company: ${client.name}\nUsername / Email: ${clientUsername}\nSign-In URL: ${window.location.origin}/login`;
            navigator.clipboard.writeText(info);
            toast('Credentials Copied', 'Login Username & Portal Sign-In URL copied to clipboard', 'info');
          };

          return (
            <Card padding="none" className="overflow-hidden border border-brand-200/60 bg-gradient-to-r from-brand-50/40 via-white to-emerald-50/30">
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => setIsCredentialsExpanded(!isCredentialsExpanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-brand-50/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-600 text-white rounded-xl shadow-xs">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                      <span>Client Portal Account & Credentials</span>
                      <Badge variant="success" className="text-[10px]">Super Admin Managed</Badge>
                    </h3>
                    <p className="text-[11px] text-surface-500">Sign-in credentials and access controls for {client.name}</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${isCredentialsExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isCredentialsExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-brand-100 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-surface-200 shadow-2xs space-y-1.5">
                      <span className="text-surface-500 font-semibold uppercase tracking-wider text-[10px] block">
                        Login Username / Email
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-sm text-brand-700 truncate">
                          {clientUsername || 'Not Provisioned Yet'}
                        </span>
                        {clientUsername && <Badge variant="primary">Username</Badge>}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-surface-200 shadow-2xs space-y-1.5">
                      <span className="text-surface-500 font-semibold uppercase tracking-wider text-[10px] block">
                        Portal Password
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-surface-800">
                          •••••••• (Bcrypt Encrypted)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsProvisionLoginOpen(true)}
                          className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold underline focus:outline-none"
                        >
                          Set Password
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-surface-200 shadow-2xs space-y-1.5">
                      <span className="text-surface-500 font-semibold uppercase tracking-wider text-[10px] block">
                        Client Sign-In URL
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-surface-700 truncate">
                          {window.location.origin}/login
                        </span>
                        <Badge variant="info">Active</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })()}

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-200 gap-4 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'projects'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Agenda & Task ({clientProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Tasks ({clientTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('consents')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'consents'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Consents ({clientConsents.length})
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'meetings'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Meetings ({clientMeetings.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'projects' && (
          <Card padding="none" className="overflow-hidden">
            {loadingProjects ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : clientProjects.length === 0 ? (
              <EmptyState
                title="No Agendas"
                description="This client has no agendas assigned yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agenda Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientProjects.map((p: any) => {
                    const tasks = p.tasks || [];
                    const done = tasks.filter((t: any) => t.status === 'completed').length;
                    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : (p.progress || 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-semibold text-surface-900">{p.name}</div>
                          {p.description && <div className="text-[11px] text-surface-500 truncate max-w-[240px]">{p.description}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'completed' ? 'success' : p.status === 'in_progress' ? 'primary' : 'default'}>
                            {p.status?.replace('_', ' ') || 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.priority === 'critical' ? 'danger' : p.priority === 'high' ? 'warning' : 'default'}>
                            {p.priority || 'Medium'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-surface-700">{formatDate(p.deadline)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold text-surface-700">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {activeTab === 'tasks' && (
          <Card padding="none" className="overflow-hidden">
            {loadingTasks ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : clientTasks.length === 0 ? (
              <EmptyState
                title="No Tasks"
                description="No tasks are assigned to this client yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Agenda</TableHead>
                    <TableHead>Recurrence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientTasks.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {t.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-surface-400 shrink-0" />
                          )}
                          <span className={`font-semibold text-surface-900 ${t.status === 'completed' ? 'line-through text-surface-500' : ''}`}>
                            {t.title}
                          </span>
                        </div>
                        {t.description && <div className="text-[11px] text-surface-500 truncate max-w-[280px] ml-6">{t.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'primary' : 'default'}>
                          {t.status?.replace('_', ' ') || 'To Do'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.priority === 'critical' || t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'default'}>
                          {t.priority || 'Medium'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-surface-700">{t.project?.name || '—'}</TableCell>
                      <TableCell>
                        {t.recurrence_type && t.recurrence_type !== 'none' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
                            <RotateCcw className="w-3 h-3" />
                            {t.recurrence_type}
                          </span>
                        ) : (
                          <span className="text-xs text-surface-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {activeTab === 'consents' && (
          <Card padding="none" className="overflow-hidden">
            {loadingConsents ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : clientConsents.length === 0 ? (
              <EmptyState
                title="No Consents"
                description="No consent requests have been created for this client."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead>Responded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientConsents.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-semibold text-surface-900">{c.title}</div>
                        {c.description && <div className="text-[11px] text-surface-500 truncate max-w-[280px]">{c.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'allowed' ? 'success' : c.status === 'denied' ? 'danger' : 'warning'}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-surface-700">{c.file_name || '—'}</TableCell>
                      <TableCell className="text-xs text-surface-700">{formatDate(c.responded_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {activeTab === 'meetings' && (
          <Card padding="none" className="overflow-hidden">
            {loadingMeetings ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : clientMeetings.length === 0 ? (
              <EmptyState
                title="No Meetings"
                description="No meetings have been scheduled for this client."
              />
            ) : (
              <div className="divide-y divide-surface-100">
                {clientMeetings.map((m: any) => (
                  <div key={m.id} className="px-5 py-4 flex items-start gap-3 hover:bg-surface-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-surface-900">{m.title}</span>
                        <Badge variant={m.status === 'cancelled' ? 'danger' : 'default'}>
                          {m.status?.replace('_', ' ')}
                        </Badge>
                        <Badge variant="info" className="uppercase text-[10px]">
                          {m.meeting_type?.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(m.start_time)} — {formatDate(m.end_time)}
                        </span>
                        {m.location && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-3 h-3" />
                            {m.location}
                          </span>
                        )}
                        {m.project?.name && (
                          <span className="flex items-center gap-1 text-brand-600 font-semibold">
                            <FolderKanban className="w-3 h-3" />
                            {m.project.name}
                          </span>
                        )}
                      </div>
                      {m.description && <p className="text-xs text-surface-600 mt-1 line-clamp-2">{m.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <DeleteClientModal
        isOpen={isDeleteOpen}
        client={client ? { id: client.id, name: client.name } : null}
        onClose={() => setIsDeleteOpen(false)}
        onSuccess={() => navigate('/clients')}
      />

      <CreateClientUserModal
        isOpen={isProvisionLoginOpen}
        clientName={client?.name || ''}
        clientEmail={client?.email || ''}
        onClose={() => setIsProvisionLoginOpen(false)}
        onSuccess={fetchClientDetails}
      />
    </MainLayout>
  );
};
