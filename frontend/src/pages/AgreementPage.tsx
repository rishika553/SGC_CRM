import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Download,
  Eye,
  Trash2,
  Plus,
  Upload,
  FileText,
  Building2,
  X,
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
import { clientQueryKeys, fetchClientDirectory, isUUID, resolveClientIdForCurrentUser } from '@/features/clients/clientQueries';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

interface AgreementRecord {
  id: string;
  title: string;
  agreementNumber: string;
  type: string;
  status: string;
  clientName: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
  hasFile: boolean;
}

export const AgreementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formClientId, setFormClientId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('service_agreement');
  const [formNotes, setFormNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');
  const isSuperAdmin = roleNameStr === 'super_admin';

  const [resolvedClientId, setResolvedClientId] = useState<string | null>(() => {
    const stored = localStorage.getItem('crm_active_client_id');
    return isUUID(stored) ? stored : null;
  });

  useEffect(() => {
    if (!isClientRole || resolvedClientId) return;
    (async () => {
      const id = await resolveClientIdForCurrentUser(true);
      if (id) setResolvedClientId(id);
    })();
  }, [isClientRole, resolvedClientId]);

  const fetchAgreements = useCallback(async () => {
    setIsLoading(true);
    try {
      const clientId = resolvedClientId || localStorage.getItem('crm_active_client_id');
      const params: any = { page: 1, page_size: 100 };
      if (isUUID(clientId)) {
        params.client_id = clientId;
      }
      const res = await api.get<PaginatedResponse<any>>('/agreements', { params });
      if (res.data.success && res.data.data) {
        setAgreements(
          res.data.data.map((agr: any) => ({
            id: agr.id,
            title: agr.title || 'Untitled Agreement',
            agreementNumber: agr.agreement_number || '',
            type: agr.type || agr.agreement_type || '',
            status: agr.status || 'draft',
            clientName: agr.client?.name || '—',
            fileName: agr.file_name || null,
            fileSize: agr.file_size || null,
            createdAt: agr.created_at,
            hasFile: Boolean(agr.file_name),
          }))
        );
      } else {
        setAgreements([]);
      }
    } catch {
      setAgreements([]);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedClientId]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  const loadClientsList = async () => {
    try {
      const clients = await queryClient.fetchQuery({
        queryKey: clientQueryKeys.directory,
        queryFn: fetchClientDirectory,
      });
      if (clients.length > 0) {
        setClientsList(clients);
        if (!formClientId) setFormClientId(clients[0].id);
      }
    } catch {}
  };

  const handleOpenUpload = () => {
    loadClientsList();
    setIsUploadModalOpen(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormNotes('');
    setSelectedFile(null);
    setFormType('service_agreement');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast('Validation Error', 'Please enter an agreement title.', 'error');
      return;
    }
    if (!formClientId) {
      toast('Validation Error', 'Please select a client.', 'error');
      return;
    }
    if (!selectedFile) {
      toast('Validation Error', 'Please select a PDF file.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/agreements', {
        title: formTitle.trim(),
        client_id: formClientId,
        type: formType,
        description: formNotes.trim() || undefined,
      });
      const agrId = res.data.data.id;

      if (selectedFile && agrId) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await api.post(`/agreements/${agrId}/upload-pdf`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast('Success', `Agreement "${formTitle.trim()}" uploaded. Client will see it on their panel.`, 'success');
      setIsUploadModalOpen(false);
      resetForm();
      fetchAgreements();
    } catch (err: any) {
      toast('Upload Failed', err.response?.data?.error?.message || 'Failed to upload agreement.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (agreementId: string, title: string) => {
    try {
      toast('Downloading', `Downloading "${title}"…`, 'info');
      const res = await api.get(`/agreements/${agreementId}/download`, { responseType: 'blob' });
      const disposition = res.headers['content-disposition'] as string | undefined;
      let filename = `${title.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`;
      const match = disposition && disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
      const url = window.URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast('Downloaded', `"${title}" downloaded successfully.`, 'success');
    } catch {
      toast('Download Failed', 'Could not download the agreement PDF.', 'error');
    }
  };

  const handlePreview = async (agreementId: string) => {
    try {
      const res = await api.get(`/agreements/${agreementId}/preview`, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast('Preview Failed', 'Could not load the agreement PDF.', 'error');
    }
  };

  const handleDelete = async (agreementId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/agreements/${agreementId}`);
      toast('Deleted', `"${title}" has been removed.`, 'success');
      fetchAgreements();
    } catch (err: any) {
      toast('Delete Failed', err.response?.data?.error?.message || 'Failed to delete agreement.', 'error');
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'executed' || s === 'signed' || s === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ● Active
        </span>
      );
    }
    if (s === 'pending_signature' || s === 'pending' || s === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          ● Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        ● {status}
      </span>
    );
  };

  return (
    <MainLayout clientName="Client Desk" pageTitle="Agreement">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#27332B] tracking-tight">Agreements</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Upload and manage client agreements. Uploaded PDFs are visible on the client panel.
            </p>
          </div>
          {!isClientRole && (
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenUpload}
              leftIcon={<Plus className="w-4 h-4" />}
              className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs whitespace-nowrap"
            >
              Upload Agreement
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : agreements.length === 0 ? (
          <div className="py-16 bg-white border border-[#E3E8E3] rounded-2xl shadow-sm">
            <EmptyState
              icon={<FileCheck2 className="w-12 h-12 text-[#5E8C61]" />}
              title="No Agreements Yet"
              description={
                isClientRole
                  ? 'Your admin will upload agreements for you here.'
                  : 'Click "Upload Agreement" to add a PDF agreement for a client.'
              }
            />
          </div>
        ) : (
          <div className="bg-white border border-[#E3E8E3] rounded-2xl overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-3 bg-[#F7F9F6] border-b border-[#E3E8E3] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
              <div className="col-span-4">Agreement</div>
              <div className="col-span-2">Client</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">File</div>
              <div className="col-span-1">Date</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Rows */}
            {agreements.map((agr) => (
              <div
                key={agr.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-3.5 border-b border-[#E3E8E3] last:border-b-0 hover:bg-[#FAFDFB] transition-colors"
              >
                {/* Title + Type */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#EEF5EF] text-[#2F4F3A] flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#27332B] truncate">{agr.title}</div>
                    <div className="text-[11px] text-[#6B7280] mt-0.5">{agr.type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Agreement'}</div>
                  </div>
                </div>

                {/* Client */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-[#27332B] truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#5E8C61] shrink-0 hidden sm:inline" />
                    {agr.clientName}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center">{statusBadge(agr.status)}</div>

                {/* File */}
                <div className="col-span-1 flex items-center">
                  {agr.hasFile ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      PDF
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">No file</span>
                  )}
                </div>

                {/* Date */}
                <div className="col-span-1 flex items-center">
                  <span className="text-xs text-[#6B7280]">{formatDate(agr.createdAt)}</span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  {agr.hasFile && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(agr.id)}
                        title="Preview PDF"
                        className="p-1.5 rounded-lg border-[#E3E8E3] hover:bg-[#EEF5EF]"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5E8C61]" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(agr.id, agr.title)}
                        title="Download PDF"
                        className="p-1.5 rounded-lg border-[#E3E8E3] hover:bg-[#EEF5EF]"
                      >
                        <Download className="w-3.5 h-3.5 text-[#2F4F3A]" />
                      </Button>
                    </>
                  )}
                  {isSuperAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(agr.id, agr.title)}
                      title="Delete agreement"
                      className="p-1.5 rounded-lg border-red-200 hover:bg-red-50 text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 sm:p-6 shadow-2xl max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#27332B]">Upload Agreement</h3>
                  <p className="text-xs text-[#6B7280]">PDF will be visible to the client on their panel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Client Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Client *</label>
                <div className="flex items-center gap-2 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2">
                  <Building2 className="w-4 h-4 text-[#5E8C61] shrink-0" />
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-semibold text-[#27332B] focus:outline-none cursor-pointer"
                    required
                  >
                    <option value="" disabled>Select client…</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <Input
                label="Agreement Title *"
                placeholder="e.g. Master Service Agreement 2026"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
                required
              />

              {/* Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-semibold text-[#27332B] focus:outline-none cursor-pointer"
                >
                  <option value="service_agreement">Service Agreement</option>
                  <option value="msa">Master Service Agreement</option>
                  <option value="nda">NDA</option>
                  <option value="sow">Statement of Work</option>
                  <option value="sla">SLA</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief description…"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl p-3 text-xs text-[#27332B] focus:outline-none focus:bg-white focus:border-[#5E8C61]"
                />
              </div>

              {/* PDF File */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">PDF File *</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 bg-[#F7F9F6] border border-dashed border-[#5E8C61] rounded-xl px-4 py-3 text-xs cursor-pointer hover:bg-[#EEF5EF] transition-colors">
                    <Upload className="w-4 h-4 text-[#5E8C61]" />
                    <span className="font-semibold text-[#27332B]">
                      {selectedFile ? selectedFile.name : 'Choose PDF…'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                      required
                    />
                  </label>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {selectedFile && (
                  <p className="text-[11px] text-[#6B7280] mt-1">{formatFileSize(selectedFile.size)}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3E8E3]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsUploadModalOpen(false); resetForm(); }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  leftIcon={<Upload className="w-4 h-4" />}
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs font-bold px-5 py-2 rounded-xl"
                >
                  Upload Agreement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
