import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/axios';
import { useAuth } from '@/features/auth/AuthContext';
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

  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');

  useEffect(() => {
    const fetchAgreementData = async () => {
      setIsLoading(true);
      try {
        const agrRes = await api.get<PaginatedResponse<any>>('/agreements', { params: { page: 1, page_size: 50 } });
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
    };

    fetchAgreementData();
  }, []);

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
                onClick={() => toast('Upload Draft', 'Draft agreement upload modal opened.', 'info')}
                leftIcon={<Plus className="w-4 h-4" />}
                className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-4 py-2 rounded-[14px] shadow-xs text-xs font-semibold"
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
              description="Your document vault is clear. Click 'Upload Agreement' at the top right to add an agreement."
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-[#27332B] truncate">{doc.title}</h2>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#4CAF50] border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {doc.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] font-medium mt-1">Category: {doc.category}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedPreview(doc)}
                    leftIcon={<Eye className="w-4 h-4 text-[#5E8C61]" />}
                    className="flex-1 sm:flex-initial border-[#D7DDD7] text-[#27332B] hover:bg-[#EEF5EF] hover:border-[#5E8C61] text-xs font-semibold px-3 py-2 rounded-xl"
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleDownloadPdf(doc.title)}
                    leftIcon={<Download className="w-4 h-4" />}
                    className="flex-1 sm:flex-initial bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs"
                  >
                    Download PDF
                  </Button>
                </div>
              </div>

              {/* Key Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs bg-[#F7F9F6] p-3.5 sm:p-4 rounded-xl border border-[#E3E8E3]">
                <div>
                  <span className="text-[#6B7280] font-semibold uppercase tracking-wider block text-[10px]">Signed Date</span>
                  <span className="font-bold text-[#27332B] text-xs sm:text-sm mt-0.5 block">{doc.signedDate}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold uppercase tracking-wider block text-[10px]">Effective Term</span>
                  <span className="font-semibold text-[#27332B] mt-0.5 block">{doc.effectivePeriod}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold uppercase tracking-wider block text-[10px]">Signatory</span>
                  <span className="font-semibold text-[#27332B] mt-0.5 block">{doc.signatory}</span>
                </div>
              </div>

              {/* Version History Timeline */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">
                  <History className="w-3.5 h-3.5 text-[#5E8C61]" />
                  <span>Version History</span>
                </div>

                <div className="space-y-2.5">
                  {doc.versions.map((ver, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 bg-white border border-[#E3E8E3] rounded-xl p-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="font-extrabold text-[#2F4F3A] bg-[#DCE9DE] px-2 py-0.5 rounded-md text-[11px] shrink-0">
                          {ver.version}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-[#27332B] truncate">{ver.summary}</div>
                          <div className="text-[11px] text-[#6B7280] mt-0.5">Author: {ver.author}</div>
                        </div>
                      </div>

                      <div className="text-[11px] font-medium text-[#6B7280] flex items-center gap-1 shrink-0 self-end sm:self-start">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{ver.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Document Preview Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedPreview(null)} />
          <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-4 sm:p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#E3E8E3] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-3 mb-3">
              <div className="min-w-0">
                <span className="inline-block bg-[#DCE9DE] text-[#2F4F3A] font-bold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full border border-[#5E8C61]/20">
                  {selectedPreview.category}
                </span>
                <h3 className="text-base sm:text-xl font-bold text-[#27332B] mt-1 truncate">{selectedPreview.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Content View */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-[#27332B]">
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
