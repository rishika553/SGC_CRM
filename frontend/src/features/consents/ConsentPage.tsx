import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  Plus,
  X,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/features/auth/AuthContext';
import { clientQueryKeys, fetchClientDirectory } from '@/features/clients/clientQueries';
import { consentApi } from '@/features/consents/consentApi';
import { Consent, ConsentStatus } from '@/types/consent';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<ConsentStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  allowed: {
    label: 'Allowed',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  denied: {
    label: 'Denied',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const STATUS_FILTERS: Array<{ value: ConsentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'allowed', label: 'Allowed' },
  { value: 'denied', label: 'Denied' },
];

const StatusBadge: React.FC<{ status: ConsentStatus }> = ({ status }) => {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${style.className}`}>
      {style.icon}
      {style.label}
    </span>
  );
};

export const ConsentPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [statusFilter, setStatusFilter] = useState<ConsentStatus | 'all'>('all');

  // Create Consent Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [formClientId, setFormClientId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Detail / Respond Modal State
  const [selectedConsent, setSelectedConsent] = useState<Consent | null>(null);
  const [responseMode, setResponseMode] = useState<'none' | 'allowed' | 'denied'>('none');
  const [denialReason, setDenialReason] = useState<string>('');
  const [responseNotes, setResponseNotes] = useState<string>('');
  const [isResponding, setIsResponding] = useState<boolean>(false);

  const fetchConsents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeClientId = localStorage.getItem('crm_active_client_id');
      const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      const params: Record<string, unknown> = { page: 1, page_size: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (isUUID(activeClientId)) params.client_id = activeClientId;

      const res = await consentApi.list(params);
      if (res.success) {
        setConsents(res.data);
      } else {
        setConsents([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load consent requests.');
      setConsents([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const loadClientsList = async () => {
    try {
      // Bypass the 5-minute stale cache so soft-deleted clients never appear
      const clients = await queryClient.fetchQuery({
        queryKey: clientQueryKeys.directory,
        queryFn: fetchClientDirectory,
        staleTime: 0,
      });
      if (clients.length > 0) {
        setClientsList(clients);
        if (!formClientId) {
          setFormClientId(clients[0].id);
        }
      }
    } catch {
      toast('Load Failed', 'Could not load client list.', 'error');
    }
  };

  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormDescription('');
    setSelectedFile(null);
    setFormClientId('');
    loadClientsList();
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast('Validation Error', 'Please enter a consent request title.', 'error');
      return;
    }
    if (!formClientId) {
      toast('Validation Error', 'Please select a target client.', 'error');
      return;
    }
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
      toast('Validation Error', 'Attachment exceeds the 20 MB limit.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await consentApi.create({
        client_id: formClientId,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        file: selectedFile,
      });
      toast('Success', `Consent request "${created.title}" created successfully.`, 'success');
      setIsCreateModalOpen(false);
      fetchConsents();
    } catch (err: any) {
      toast('Create Failed', err.response?.data?.error?.message || 'Failed to create consent request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDetail = (consent: Consent) => {
    setSelectedConsent(consent);
    setResponseMode('none');
    setDenialReason('');
    setResponseNotes('');
  };

  const handleRespond = async (status: 'allowed' | 'denied') => {
    if (!selectedConsent) return;
    setIsResponding(true);
    try {
      const updated = await consentApi.respond(selectedConsent.id, {
        status,
        denial_reason: status === 'denied' && denialReason.trim() ? denialReason.trim() : undefined,
        response_notes: responseNotes.trim() || undefined,
      });
      setSelectedConsent(updated);
      setConsents((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast('Success', status === 'allowed' ? 'Consent request allowed.' : 'Consent request denied.', 'success');
      setResponseMode('none');
    } catch (err: any) {
      toast('Response Failed', err.response?.data?.error?.message || 'Failed to submit consent response.', 'error');
    } finally {
      setIsResponding(false);
    }
  };

  const handleDownload = async (consent: Consent) => {
    try {
      await consentApi.download(consent.id);
      toast('Download Started', `Downloading "${consent.file_name}".`, 'info');
    } catch (err: any) {
      toast('Download Failed', err.response?.data?.error?.message || 'Failed to download attachment.', 'error');
    }
  };

  const handleDeleteConsent = async (consent: Consent) => {
    if (!window.confirm(`Are you sure you want to delete consent request "${consent.title}"? This action is permanent.`)) return;
    try {
      await consentApi.remove(consent.id);
      setConsents((prev) => prev.filter((c) => c.id !== consent.id));
      if (selectedConsent?.id === consent.id) setSelectedConsent(null);
      toast('Consent Deleted', `"${consent.title}" removed successfully.`, 'success');
    } catch (err: any) {
      toast('Delete Failed', err.response?.data?.error?.message || 'Failed to delete consent request.', 'error');
    }
  };

  const pendingCount = consents.filter((c) => c.status === 'pending').length;
  const allowedCount = consents.filter((c) => c.status === 'allowed').length;
  const deniedCount = consents.filter((c) => c.status === 'denied').length;

  const selected = selectedConsent;

  return (
    <MainLayout clientName={selectedConsent?.client?.name || 'Client Desk'} pageTitle="Consent">
      <div className="space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <h1 className="text-3xl font-extrabold text-[#27332B] tracking-tight">Consent Management</h1>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              {isClientRole
                ? 'Review assigned consent requests, read the terms, and record your decision.'
                : 'Create and track client consent requests with full response history.'}
            </p>
          </div>

          {!isClientRole && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="w-5 h-5" />}
              className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-[14px] shadow-xs text-sm font-bold w-full sm:w-auto"
            >
              Create Consent Request
            </Button>
          )}
        </div>

        {/* Status Summary Banner */}
        <div className="bg-[#EEF5EF] border border-[#D7DDD7] rounded-[20px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] font-bold flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#27332B]">
                {consents.length > 0
                  ? `${consents.length} Consent Request${consents.length === 1 ? '' : 's'} Tracked`
                  : 'No Consent Requests'}
              </div>
              <div className="text-xs text-[#6B7280] mt-0.5">
                {isClientRole
                  ? 'Respond to pending requests to keep your engagement records up to date.'
                  : 'Pending consents await client response. Allowed consents are active authorizations.'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#B45309] bg-white border border-amber-200 px-3 py-1 rounded-full">
              ● {pendingCount} Pending
            </span>
            <span className="text-xs font-bold text-[#15803D] bg-white border border-emerald-200 px-3 py-1 rounded-full">
              ● {allowedCount} Allowed
            </span>
            <span className="text-xs font-bold text-[#B91C1C] bg-white border border-rose-200 px-3 py-1 rounded-full">
              ● {deniedCount} Denied
            </span>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={
                statusFilter === f.value
                  ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#2F4F3A] text-white shadow-xs transition-all'
                  : 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#E3E8E3] text-[#27332B] hover:border-[#5E8C61] transition-all'
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-[20px]" />
            <Skeleton className="h-40 w-full rounded-[20px]" />
            <Skeleton className="h-40 w-full rounded-[20px]" />
          </div>
        ) : error ? (
          <div className="py-14 bg-white border border-[#E3E8E3] rounded-[20px] shadow-[0_6px_20px_rgba(47,79,58,.05)] text-center">
            <div className="text-rose-600 font-bold text-sm mb-2">{error}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchConsents}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Retry
            </Button>
          </div>
        ) : consents.length === 0 ? (
          <div className="py-14 bg-white border border-[#E3E8E3] rounded-[20px] shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            <EmptyState
              icon={<ClipboardCheck className="w-12 h-12 text-[#5E8C61]" />}
              title="No Consent Requests"
              description={
                isClientRole
                  ? 'You have no assigned consent requests right now. New requests will appear here for review.'
                  : 'Click "Create Consent Request" at the top right to request consent from a client.'
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {consents.map((consent) => {
              return (
                <div
                  key={consent.id}
                  className="bg-white border border-[#E3E8E3] rounded-[20px] p-4 sm:p-6 shadow-[0_6px_20px_rgba(47,79,58,.05)] space-y-4 transition-all hover:border-[#5E8C61]/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2F4F3A] text-white font-bold flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                        <ClipboardCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#DCE9DE]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-extrabold text-[#27332B]">{consent.title}</h2>
                          <StatusBadge status={consent.status} />
                        </div>
                        <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                          {isClientRole ? (
                            <>Requested: {formatDate(consent.created_at)}</>
                          ) : (
                            <>
                              Client Entity: <b className="text-[#27332B]">{consent.client?.name || 'Unknown'}</b> • Requested:{' '}
                              {formatDate(consent.created_at)}
                            </>
                          )}
                        </p>
                        {consent.description && (
                          <p className="text-xs text-[#6B7280] mt-1.5 line-clamp-2">{consent.description}</p>
                        )}
                        {consent.status === 'denied' && consent.denial_reason && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-[#FDF1F1] border border-[#F5C6C6] text-[#B91C1C] text-[11px] font-semibold rounded-lg px-2.5 py-1.5">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="line-clamp-1">Denial Reason: {consent.denial_reason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto shrink-0">
                      {consent.file_name && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(consent)}
                          leftIcon={<Download className="w-4 h-4 text-[#2F4F3A]" />}
                          className="border-[#2F4F3A] text-[#2F4F3A] hover:bg-[#DCE9DE] text-xs font-bold rounded-xl"
                        >
                          Attachment
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(consent)}
                        leftIcon={<Eye className="w-4 h-4 text-[#5E8C61]" />}
                        className="border-[#E3E8E3] text-[#27332B] hover:bg-[#EEF5EF] text-xs font-bold rounded-xl"
                      >
                        {isClientRole ? 'View & Respond' : 'View Details'}
                      </Button>
                      {!isClientRole && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteConsent(consent)}
                          leftIcon={<Trash2 className="w-4 h-4 text-rose-600" />}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Super Admin Create Consent Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-[#E3E8E3] rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#27332B]">Create Consent Request</h3>
                  <p className="text-xs text-slate-500">Request explicit consent from a client company</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Target Client Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Select Client Company *</label>
                <div className="flex items-center gap-2 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2">
                  <Building2 className="w-4 h-4 text-[#5E8C61] shrink-0" />
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-semibold text-[#27332B] focus:outline-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>
                      Select Target Client Company...
                    </option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Consent Title */}
              <Input
                label="Consent Title *"
                placeholder="e.g. Data Processing & Sharing Consent"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
                required
              />

              {/* Description / Terms */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Description / Terms</label>
                <textarea
                  rows={4}
                  placeholder="Enter the consent description, terms, or legal language the client must review..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl p-3 text-xs text-[#27332B] focus:outline-none focus:bg-white focus:border-[#5E8C61]"
                />
              </div>

              {/* Optional Attachment */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Optional Attachment (Max 20 MB)</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#DCE9DE] file:text-[#2F4F3A] hover:file:bg-[#2F4F3A] hover:file:text-white cursor-pointer"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 bg-[#EEF5EF] border border-[#D7DDD7] rounded-lg px-3 py-1.5 text-xs text-[#27332B]">
                    <Paperclip className="w-3.5 h-3.5 text-[#5E8C61] shrink-0" />
                    <span className="truncate font-semibold">{selectedFile.name}</span>
                    <span className="text-[#6B7280]">({formatFileSize(selectedFile.size)})</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-[#E3E8E3]">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-sm font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSubmitting}
                  leftIcon={<Plus className="w-5 h-5" />}
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-sm font-bold px-6 py-3 rounded-xl"
                >
                  Create Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / Respond Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-[#E3E8E3] rounded-2xl p-6 shadow-2xl max-w-2xl w-full space-y-4 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center font-bold shrink-0">
                  <ClipboardCheck className="w-4.5 h-4.5 text-[#DCE9DE]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-[#27332B] truncate">{selected.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={selected.status} />
                    {!isClientRole && selected.client && (
                      <span className="text-[10px] font-bold text-[#5E8C61] uppercase tracking-wider">
                        {selected.client.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Terms & Description */}
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description / Terms</div>
              <div className="p-4 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl text-xs whitespace-pre-wrap leading-relaxed text-[#27332B]">
                {selected.description || 'No description provided for this consent request.'}
              </div>
            </div>

            {/* Attachment */}
            {selected.file_name && (
              <div className="flex items-center justify-between gap-3 bg-[#EEF5EF] border border-[#D7DDD7] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Paperclip className="w-4 h-4 text-[#5E8C61] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#27332B] truncate">{selected.file_name}</div>
                    <div className="text-[10px] text-[#6B7280]">{formatFileSize(selected.file_size)}</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selected)}
                  leftIcon={<Download className="w-4 h-4 text-[#2F4F3A]" />}
                  className="border-[#2F4F3A] text-[#2F4F3A] hover:bg-[#DCE9DE] text-xs font-bold rounded-xl shrink-0"
                >
                  Download
                </Button>
              </div>
            )}

            {/* Response Details */}
            {selected.status !== 'pending' && (
              <div className="border-t border-[#E3E8E3] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#6B7280] font-semibold block">Responded On</span>
                  <span className="font-bold text-[#27332B] mt-0.5 block">{formatDate(selected.responded_at)}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold block">Responded By</span>
                  <span className="font-bold text-[#27332B] mt-0.5 block">
                    {selected.responded_by ? `${selected.responded_by.first_name} ${selected.responded_by.last_name}` : 'Client Portal'}
                  </span>
                </div>
                {selected.status === 'denied' && (
                  <div className="sm:col-span-2">
                    <span className="text-[#6B7280] font-semibold block">Denial Reason</span>
                    <span className="font-bold text-[#B91C1C] mt-0.5 block whitespace-pre-wrap">
                      {selected.denial_reason || 'No reason provided.'}
                    </span>
                  </div>
                )}
                {selected.response_notes && (
                  <div className="sm:col-span-2">
                    <span className="text-[#6B7280] font-semibold block">Response Notes</span>
                    <span className="font-bold text-[#27332B] mt-0.5 block whitespace-pre-wrap">{selected.response_notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Client Response Actions (only for pending, client role) */}
            {isClientRole && selected.status === 'pending' && (
              <div className="border-t border-[#E3E8E3] pt-4 space-y-3">
                {responseMode === 'none' && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="lg"
                      onClick={() => setResponseMode('denied')}
                      leftIcon={<XCircle className="w-4 h-4" />}
                      className="flex-1 sm:flex-none text-sm font-bold rounded-xl py-3"
                    >
                      Deny
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      onClick={() => setResponseMode('allowed')}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      className="flex-1 sm:flex-none bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-sm font-bold rounded-xl py-3"
                    >
                      Allow
                    </Button>
                  </div>
                )}

                {responseMode !== 'none' && (
                  <div className="bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl p-4 space-y-3">
                    {responseMode === 'denied' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 block">Denial Reason (Optional)</label>
                        <textarea
                          rows={3}
                          placeholder="Provide a reason for denying this consent request..."
                          value={denialReason}
                          onChange={(e) => setDenialReason(e.target.value)}
                          className="w-full bg-white border border-[#E3E8E3] rounded-xl p-3 text-xs text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">Response Notes (Optional)</label>
                      <textarea
                        rows={2}
                        placeholder="Add any notes about your decision..."
                        value={responseNotes}
                        onChange={(e) => setResponseNotes(e.target.value)}
                        className="w-full bg-white border border-[#E3E8E3] rounded-xl p-3 text-xs text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                      />
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setResponseMode('none')}
                        disabled={isResponding}
                        className="text-sm font-semibold"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        isLoading={isResponding}
                        onClick={() => handleRespond(responseMode)}
                        leftIcon={responseMode === 'allowed' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        className={`text-sm font-bold rounded-xl py-3 ${
                          responseMode === 'allowed'
                            ? 'bg-[#2F4F3A] hover:bg-[#243E2E] text-white'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                      >
                        Confirm {responseMode === 'allowed' ? 'Allow' : 'Deny'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Admin: no response actions available */}
            {!isClientRole && (
              <div className="pt-3 mt-3 flex items-center justify-end gap-2 flex-wrap border-t border-[#E3E8E3]">
                <span className="text-[11px] text-[#6B7280] mr-auto">
                  Created {formatDate(selected.created_at)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteConsent(selected)}
                  leftIcon={<Trash2 className="w-4 h-4 text-rose-600" />}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl"
                >
                  Delete
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedConsent(null)} className="text-xs">
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
};
