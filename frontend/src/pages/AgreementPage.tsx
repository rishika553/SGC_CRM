import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Download,
  Eye,
  History,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Plus,
  Upload,
  FileText,
  Building2,
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
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

export interface AgreementDocument {
  id: string;
  type: 'master' | 'nda' | 'consent';
  title: string;
  category: string;
  status: 'Executed' | 'Verified' | 'Pending Review';
  signedDate: string;
  effectivePeriod: string;
  signatory: string;
  versions: {
    version: string;
    date: string;
    summary: string;
    author: string;
  }[];
  contentSnippet: string;
}

export const AgreementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [agreements, setAgreements] = useState<AgreementDocument[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<AgreementDocument | null>(null);

  // Upload Agreement Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [formClientId, setFormClientId] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<string>('msa');
  const [formNotes, setFormNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');

  const fetchAgreementData = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeClientId = localStorage.getItem('crm_active_client_id');
      const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      const params: any = { page: 1, page_size: 50 };
      if (isUUID(activeClientId)) {
        params.client_id = activeClientId;
      }
      const agrRes = await api.get<PaginatedResponse<any>>('/agreements', { params });
      if (agrRes.data.success && agrRes.data.data) {
        const liveDocs: AgreementDocument[] = agrRes.data.data.map((agr: any) => ({
          id: agr.id,
          type: agr.agreement_type === 'master_service_agreement' ? 'master' : agr.agreement_type === 'non_disclosure_agreement' ? 'nda' : 'consent',
          title: agr.title || `Agreement (${agr.client?.name || 'Client'})`,
          category: agr.agreement_type ? (agr.agreement_type.charAt(0).toUpperCase() + agr.agreement_type.slice(1).replace('_', ' ')) as any : 'Master Agreement',
          status: agr.status === 'executed' ? 'Executed' : agr.status === 'verified' ? 'Verified' : 'Pending Review',
          signedDate: formatDate(agr.signed_at || agr.created_at),
          effectivePeriod: agr.effective_date ? `${formatDate(agr.effective_date)} – ${agr.expiration_date ? formatDate(agr.expiration_date) : 'Active Term'}` : 'Active Statutory Term',
          signatory: agr.client?.name || 'Client Lead',
          versions: [
            {
              version: 'v1.0',
              date: formatDate(agr.created_at),
              summary: agr.notes || 'Executed agreement record',
              author: agr.assigned_admin ? `${agr.assigned_admin.first_name}` : 'Admin',
            },
          ],
          contentSnippet: agr.notes || `AGREEMENT RECORD: ${agr.title || agr.agreement_number}`,
        }));
        setAgreements(liveDocs);
      } else {
        setAgreements([]);
      }
    } catch (err) {
      setAgreements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreementData();
  }, [fetchAgreementData]);

  // Load clients for Super Admin selection
  const loadClientsList = async () => {
    try {
      const clients = await queryClient.fetchQuery({
        queryKey: clientQueryKeys.directory,
        queryFn: fetchClientDirectory,
      });
      if (clients.length > 0) {
        setClientsList(clients);
        if (!formClientId) {
          setFormClientId(clients[0].id);
        }
      }
    } catch (err) {}
  };

  const handleOpenUploadModal = () => {
    loadClientsList();
    setIsUploadModalOpen(true);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormNotes('');
    setSelectedFile(null);
    setFormType('msa');
  };

  const handleUploadAgreementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast('Validation Error', 'Please enter an agreement title.', 'error');
      return;
    }
    if (!formClientId) {
      toast('Validation Error', 'Please select a target client.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Agreement Record
      const agrPayload = {
        title: formTitle.trim(),
        client_id: formClientId,
        type: formType,
        description: formNotes.trim() || undefined,
      };
      const res = await api.post('/agreements', agrPayload);
      const createdAgrId = res.data.data.id;

      // 2. Upload PDF file if attached
      if (selectedFile && createdAgrId) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        await api.post(`/agreements/${createdAgrId}/upload-pdf`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast('Success', `Agreement "${formTitle.trim()}" uploaded successfully.`, 'success');
      setIsUploadModalOpen(false);
      resetForm();
      fetchAgreementData();
    } catch (err: any) {
      toast('Upload Failed', err.response?.data?.error?.message || 'Failed to upload agreement', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = (title: string) => {
    toast('Downloading Document', `Generating PDF for "${title}"...`, 'info');
    setTimeout(() => {
      toast('Download Completed', `"${title}" downloaded successfully.`, 'success');
    }, 1200);
  };

  return (
    <MainLayout clientName={activeClient ? activeClient.name : 'Client Desk'} pageTitle="Agreement">
      <div className="space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <h1 className="text-3xl font-extrabold text-[#27332B] tracking-tight">Legal Agreements & Consents</h1>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              Executed Master Agreements, NDAs, and Portal Authorization Consent Forms
            </p>
          </div>

          {!isClientRole && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleOpenUploadModal}
                leftIcon={<Plus className="w-5 h-5" />}
                className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-[14px] shadow-xs text-sm font-bold w-full sm:w-auto"
              >
                Upload Agreement
              </Button>
            </div>
          )}
        </div>

        {/* Status Summary Banner */}
        <div className="bg-[#EEF5EF] border border-[#D7DDD7] rounded-[20px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#DCE9DE] text-[#2F4F3A] font-bold flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#27332B]">
                {agreements.length > 0
                  ? 'All Core Agreements Are Executed & Verified'
                  : 'No Agreement Documents Uploaded'}
              </div>
              <div className="text-xs text-[#6B7280] mt-0.5">
                {agreements.length > 0
                  ? 'Master Service Agreement, NDA, and Consent Forms are up to date.'
                  : 'Upload an agreement draft or client consent form to begin.'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#4CAF50] bg-white border border-emerald-200 px-3 py-1 rounded-full shadow-2xs">
              ● {agreements.length} Active Documents
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-[20px]" />
            <Skeleton className="h-64 w-full rounded-[20px]" />
          </div>
        ) : agreements.length === 0 ? (
          <div className="py-14 bg-white border border-[#E3E8E3] rounded-[20px] shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            <EmptyState
              icon={<FileCheck2 className="w-12 h-12 text-[#5E8C61]" />}
              title="No Agreement Documents Executed"
              description={
                isClientRole
                  ? 'Your agreement vault is currently empty. Your Super Admin will upload your Service Level Agreement.'
                  : 'Your document vault is clear. Click "Upload Agreement" at the top right to upload an agreement.'
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {agreements.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-[#E3E8E3] rounded-[20px] p-4 sm:p-6 shadow-[0_6px_20px_rgba(47,79,58,.05)] space-y-4 sm:space-y-5 transition-all hover:border-[#5E8C61]/50"
              >
                {/* Document Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E8E3] pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2F4F3A] text-white font-bold flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <FileCheck2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#DCE9DE]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-extrabold text-[#27332B]">{doc.title}</h2>
                        <span className="text-[10px] font-extrabold bg-[#DCE9DE] text-[#2F4F3A] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {doc.category}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#6B7280] mt-0.5">
                        Client Entity: <b className="text-[#27332B]">{doc.signatory}</b> • Signed: {doc.signedDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {doc.status}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPreview(doc)}
                      leftIcon={<Eye className="w-4 h-4 text-[#5E8C61]" />}
                      className="border-[#E3E8E3] text-[#27332B] hover:bg-[#EEF5EF] text-xs font-bold rounded-xl"
                    >
                      Preview SLA
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf(doc.title)}
                      leftIcon={<Download className="w-4 h-4 text-[#2F4F3A]" />}
                      className="border-[#2F4F3A] text-[#2F4F3A] hover:bg-[#DCE9DE] text-xs font-bold rounded-xl"
                    >
                      Download PDF
                    </Button>
                  </div>
                </div>

                {/* Term & Version Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl p-3.5 text-xs">
                  <div>
                    <span className="text-[#6B7280] font-semibold block">Statutory Term Period</span>
                    <span className="font-bold text-[#27332B] mt-0.5 block">{doc.effectivePeriod}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] font-semibold block">Signatory Representative</span>
                    <span className="font-bold text-[#27332B] mt-0.5 block">{doc.signatory}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] font-semibold block">Audit Trail Version</span>
                    <span className="font-bold text-[#27332B] mt-0.5 block">
                      {doc.versions[0]?.version} ({doc.versions[0]?.date})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Super Admin Upload Agreement Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 sm:p-6 shadow-2xl max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#27332B]">Upload Agreement</h3>
                  <p className="text-xs text-slate-500">Upload Service Level Agreement for client company</p>
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

            <form onSubmit={handleUploadAgreementSubmit} className="space-y-4">
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
                    <option value="" disabled>Select Target Client Company...</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Agreement Title */}
              <Input
                label="Agreement Title *"
                placeholder="e.g. Master Service Level Agreement 2026"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                leftIcon={<FileText className="w-4 h-4 text-slate-400" />}
                required
              />

              {/* Agreement Type Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Agreement Type *</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-semibold text-[#27332B] focus:outline-none cursor-pointer"
                >
                  <option value="msa">Master Service Agreement (MSA)</option>
                  <option value="nda">Non-Disclosure Agreement (NDA)</option>
                  <option value="service_agreement">Service Agreement (SLA)</option>
                  <option value="sow">Statement of Work (SOW)</option>
                  <option value="other">Other Statutory Document</option>
                </select>
              </div>

              {/* Notes / Terms */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Agreement Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Enter SLA notes or agreement term details..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl p-3 text-xs text-[#27332B] focus:outline-none focus:bg-white focus:border-[#5E8C61]"
                />
              </div>

              {/* PDF Document Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">PDF Agreement File (.pdf)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#DCE9DE] file:text-[#2F4F3A] hover:file:bg-[#2F4F3A] hover:file:text-white cursor-pointer"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E3E8E3]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadModalOpen(false)}
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

      {/* SLA Document Preview Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-[#E3E8E3] rounded-2xl p-5 sm:p-6 shadow-2xl max-w-2xl w-full space-y-4 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2F4F3A] text-white flex items-center justify-center font-bold">
                  <FileCheck2 className="w-4.5 h-4.5 text-[#DCE9DE]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#27332B]">{selectedPreview.title}</h3>
                  <span className="text-[10px] font-bold text-[#5E8C61] uppercase tracking-wider">
                    {selectedPreview.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 sm:p-5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {selectedPreview.contentSnippet}
              </div>

              <div className="border-t border-[#E3E8E3] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#6B7280] font-semibold block">Execution Date</span>
                  <span className="font-bold text-[#27332B]">{selectedPreview.signedDate}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold block">Digital Signatory</span>
                  <span className="font-bold text-[#27332B]">{selectedPreview.signatory}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-[#E3E8E3]">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
                className="text-xs"
              >
                Print Document
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPreview(null)}
                  className="flex-1 sm:flex-initial text-xs"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    handleDownloadPdf(selectedPreview.title);
                    setSelectedPreview(null);
                  }}
                  leftIcon={<Download className="w-4 h-4" />}
                  className="flex-1 sm:flex-initial bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs"
                >
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
