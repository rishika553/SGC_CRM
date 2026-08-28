import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderLock,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Download,
  Upload,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  Plus,
  Lock,
  X,
  Printer,
  ArrowUpDown,
  Trash2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn, formatName } from '@/lib/utils';
import { api } from '@/lib/axios';
import { useAuth } from '@/features/auth/AuthContext';
import { resolveClientIdForCurrentUser, fetchMyClient } from '@/features/clients/clientQueries';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

export interface VaultDocument {
  id: string;
  name: string;
  category: 'GST & Tax Filings' | 'Audit & Financials' | 'Corporate Legal' | 'Agreements' | 'Bank Statements';
  fileType: 'pdf' | 'xlsx' | 'docx' | 'png';
  fileSize: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  clientId?: string;
  clientName?: string;
  encrypted: boolean;
  contentSnippet: string;
}

export const DocumentsPage: React.FC = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [clientList, setClientList] = useState<{ id: string; name: string }[]>([]);
  const [uploadClientId, setUploadClientId] = useState<string>('');

  // Search, Category, Filter, and Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Vaults');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'size' | 'name'>('newest');

  // Preview & Upload Modal state
  const [selectedPreview, setSelectedPreview] = useState<VaultDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<VaultDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'GST & Tax Filings' as VaultDocument['category'],
    fileType: 'pdf' as VaultDocument['fileType'],
  });

  const loadClients = async () => {
    try {
      const all: { id: string; name: string }[] = [];
      const seen = new Set<string>();
      for (let page = 1; page <= 20; page++) {
        const clientRes = await api.get<any>('/clients', { params: { page, page_size: 100 } });
        const pageClients: any[] = clientRes.data?.data || [];
        for (const c of pageClients) {
          if (c.id && !seen.has(c.id)) {
            seen.add(c.id);
            all.push({ id: c.id, name: c.name || c.company_name || 'Client' });
          }
        }
        if (pageClients.length < 100) break;
      }
      setClientList(all);
      return all;
    } catch {
      return [];
    }
  };

  const mapDocument = (d: any): VaultDocument => ({
    id: d.id,
    name: d.file_name || d.title || 'Document.pdf',
    category: d.category ? (d.category.charAt(0).toUpperCase() + d.category.slice(1).replace('_', ' ')) as any : 'GST & Tax Filings',
    fileType: d.mime_type?.includes('spreadsheet') || d.file_name?.endsWith('.xlsx') ? 'xlsx' : d.mime_type?.includes('word') || d.file_name?.endsWith('.docx') ? 'docx' : d.mime_type?.includes('image') ? 'png' : 'pdf',
    fileSize: d.file_size ? `${(d.file_size / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB',
    sizeBytes: d.file_size || 1200000,
    uploadedAt: formatDate(d.created_at),
    uploadedBy: d.uploaded_by ? formatName(d.uploaded_by.first_name, d.uploaded_by.last_name) : 'Admin',
    clientId: d.client_id || '',
    clientName: d.client?.name || d.client?.company_name || '',
    encrypted: true,
    contentSnippet: d.description || `DOCUMENT RECORD: ${d.title || d.file_name}`,
  });

  const resolveScopedClientId = async () => {
    let activeClientId = await resolveClientIdForCurrentUser(isClientRole);
    if (isClientRole) {
      try {
        const profile = await fetchMyClient();
        if (profile) {
          setActiveClient(profile);
          activeClientId = profile.id;
        }
      } catch {}
    }
    const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    return isUUID(activeClientId) ? activeClientId : null;
  };

  const fetchActiveDocuments = async () => {
    const params: any = { page: 1, page_size: 50 };
    const scoped = await resolveScopedClientId();
    if (scoped) params.client_id = scoped;
    const docRes = await api.get<PaginatedResponse<any>>('/documents', { params });
    if (docRes.data.success && docRes.data.data) {
      setDocuments(docRes.data.data.map(mapDocument));
    } else {
      setDocuments([]);
    }
  };

  useEffect(() => {
    const fetchVaultData = async () => {
      setIsLoading(true);
      try {
        await fetchActiveDocuments();
        if (!isClientRole) {
          await loadClients();
        }
      } catch (err) {
        setDocuments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVaultData();
  }, []);

  const categories = [
    'All Vaults',
    'GST & Tax Filings',
    'Audit & Financials',
    'Corporate Legal',
    'Agreements',
    'Bank Statements',
  ];

  // Filtered and Sorted Documents List
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch =
          doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All Vaults' || doc.category === selectedCategory;
        const matchesFileType = fileTypeFilter === 'All' || doc.fileType === fileTypeFilter.toLowerCase();
        return matchesSearch && matchesCategory && matchesFileType;
      })
      .sort((a, b) => {
        if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return b.id.localeCompare(a.id);
      });
  }, [documents, searchQuery, selectedCategory, fileTypeFilter, sortBy]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDeleteDocument = async (docId: string, docName: string) => {
    setIsDeleting(true);
    try {
      const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      if (isUUID(docId)) {
        await api.delete(`/documents/${docId}`);
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setConfirmDelete(null);
      toast('Document Deleted', `"${docName}" deleted from the vault.`, 'success');
    } catch (err: any) {
      setConfirmDelete(null);
      toast('Delete Failed', err.response?.data?.error?.message || 'Unable to delete document.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (docId: string, docName: string) => {
    try {
      const res = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = docName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast('Download Complete', `"${docName}" downloaded securely.`, 'success');
    } catch (err: any) {
      toast('Download Failed', err.response?.data?.error?.message || 'Unable to download document.', 'error');
    }
  };

  const handleAssignClient = async (docId: string, clientId: string, docName: string) => {
    if (!clientId) return;
    const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    if (!isUUID(clientId)) return;

    try {
      await api.patch(`/documents/${docId}`, { client_id: clientId });
      const client = clientList.find((c) => c.id === clientId);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, clientId, clientName: client?.name || '' } : d))
      );
      toast('Document Sent', `"${docName}" sent to ${client?.name || 'client'}'s portal.`, 'success');
    } catch (err: any) {
      toast('Send Failed', err.response?.data?.error?.message || 'Unable to send document to client.', 'error');
    }
  };

  const categoryToBackend: Record<string, string> = {
    'GST & Tax Filings': 'tax_doc',
    'Audit & Financials': 'report',
    'Corporate Legal': 'compliance',
    'Agreements': 'contract',
    'Bank Statements': 'invoice_bill',
  };

  const handleOpenUpload = async () => {
    let clients = clientList;
    if (clients.length === 0) {
      clients = await loadClients();
    }
    setUploadClientId((prev) => prev || clients?.[0]?.id || '');
    setIsUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.name.trim()) return;

    if (!isClientRole && !uploadClientId) {
      toast('Select a Client', 'Please select a client to send this document to.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      
      const formData = new FormData();
      const fileToUpload = selectedFile || new File(["Vault Document Content"], `${uploadForm.name.trim()}.${uploadForm.fileType}`, { type: "application/pdf" });
      
      formData.append('file', fileToUpload);
      formData.append('title', uploadForm.name.trim());
      formData.append('category', categoryToBackend[uploadForm.category] || 'other');
      formData.append('description', `Uploaded document under category ${uploadForm.category}`);

      if (!isClientRole && uploadClientId && isUUID(uploadClientId)) {
        formData.append('client_id', uploadClientId);
      } else if (isClientRole && activeClient?.id && isUUID(activeClient.id)) {
        formData.append('client_id', activeClient.id);
      }

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedDoc = res.data?.data;
      const newDoc: VaultDocument = {
        id: uploadedDoc?.id || `vault-doc-${Date.now()}`,
        name: uploadForm.name.trim().endsWith(`.${uploadForm.fileType}`)
          ? uploadForm.name.trim()
          : `${uploadForm.name.trim()}.${uploadForm.fileType}`,
        category: uploadForm.category,
        fileType: uploadForm.fileType,
        fileSize: uploadedDoc?.file_size ? `${(uploadedDoc.file_size / 1024 / 1024).toFixed(1)} MB` : '2.4 MB',
        sizeBytes: uploadedDoc?.file_size || 2516582,
        uploadedAt: formatDate(new Date()),
        uploadedBy: activeClient ? activeClient.name : 'Superadmin',
        clientId: uploadClientId,
        clientName: clientList.find((c) => c.id === uploadClientId)?.name || '',
        encrypted: true,
        contentSnippet: `SECURE VAULT DOCUMENT ENTRY\nUploaded document: ${uploadForm.name}\nCategory: ${uploadForm.category}\nSecurity Status: 256-bit AES Encrypted.`,
      };

      setDocuments((prev) => [newDoc, ...prev]);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadForm({ name: '', category: 'GST & Tax Filings', fileType: 'pdf' });
      setUploadClientId('');
      toast('Document Sent', `"${newDoc.name}" uploaded. The client will see it on their portal.`, 'success');
    } catch (err: any) {
      toast('Upload Failed', err.response?.data?.error?.message || 'Failed to upload document.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const fileTypeBadges = {
    pdf: { label: 'PDF', bg: 'bg-rose-50 text-[#DC2626] border-rose-200', icon: <FileText className="w-5 h-5 text-[#DC2626]" /> },
    xlsx: { label: 'EXCEL', bg: 'bg-emerald-50 text-[#16A34A] border-emerald-200', icon: <FileSpreadsheet className="w-5 h-5 text-[#16A34A]" /> },
    docx: { label: 'WORD', bg: 'bg-blue-50 text-blue-800 border-blue-200', icon: <FileCode className="w-5 h-5 text-blue-700" /> },
    png: { label: 'IMAGE', bg: 'bg-purple-50 text-purple-800 border-purple-200', icon: <ImageIcon className="w-5 h-5 text-purple-700" /> },
  };

  return (
    <MainLayout clientName={activeClient ? activeClient.name : 'Client Desk'} pageTitle="Documents">
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#5E8C61] bg-[#DCE9DE] px-3 py-1 rounded-full border border-[#5E8C61]/20 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                256-bit AES Encrypted
              </span>
            </div>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              Encrypted Corporate Document Repository, Statutory Tax Filings & Audit Vault
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isClientRole && (
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={handleOpenUpload}
                leftIcon={<Upload className="w-5 h-5" />}
                className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-[16px] shadow-xs text-sm font-bold w-full sm:w-auto"
              >
                Upload Document
              </Button>
            )}
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'text-xs font-bold px-4 py-2 rounded-xl transition-all whitespace-nowrap border shrink-0',
                selectedCategory === cat
                  ? 'bg-[#2F4F3A] text-white border-[#2F4F3A] shadow-xs'
                  : 'bg-white text-[#27332B] border-[#E3E8E3] hover:bg-[#EEF5EF] hover:border-[#5E8C61]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Toolbar Card: Search, Filter, Sort */}
        <div className="bg-white border border-[#E3E8E3] rounded-[20px] p-3.5 sm:p-4 shadow-[0_6px_20px_rgba(47,79,58,.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search documents, file names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="bg-[#F7F9F6] border-[#E3E8E3] focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-2"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* File Type Filter */}
            <div className="w-full sm:w-auto flex items-center gap-1.5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-2.5 sm:px-3 py-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#5E8C61] shrink-0" />
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                className="w-full bg-transparent border-none text-[#27332B] font-semibold text-xs focus:outline-none cursor-pointer"
              >
                <option value="All">All File Types</option>
                <option value="PDF">PDF Documents</option>
                <option value="XLSX">Excel Spreadsheets</option>
                <option value="DOCX">Word Documents</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="w-full sm:w-auto flex items-center gap-1.5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-2.5 sm:px-3 py-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5E8C61] shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-transparent border-none text-[#27332B] font-semibold text-xs focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="size">File Size</option>
                <option value="name">Document Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Responsive Document Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            <Skeleton className="h-56 w-full rounded-[20px]" />
            <Skeleton className="h-56 w-full rounded-[20px]" />
            <Skeleton className="h-56 w-full rounded-[20px]" />
            <Skeleton className="h-56 w-full rounded-[20px]" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-14 bg-white border border-[#E3E8E3] rounded-[20px] shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            <EmptyState
              icon={<FolderLock className="w-12 h-12 text-[#5E8C61]" />}
              title="No Vault Documents Found"
              description={isClientRole
                ? 'Your admin will upload documents for you here. Newly received documents will appear in this vault.'
                : "No document records match your current search or category filter. Click 'Upload Document' at the top right to send a document to a client."}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredDocuments.map((doc) => {
              const badge = fileTypeBadges[doc.fileType] || fileTypeBadges.pdf;
              return (
                <div
                  key={doc.id}
                  className="bg-white border border-[#E3E8E3] rounded-[20px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(47,79,58,.05)] flex flex-col justify-between space-y-4 hover:border-[#5E8C61]/50 transition-all hover:shadow-md group"
                >
                  <div className="space-y-3">
                    {/* Header: File Badge & Category */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#F7F9F6] border border-[#E3E8E3] shrink-0">
                        {badge.icon}
                      </div>
                      <span className="text-[10px] font-bold text-[#2F4F3A] bg-[#DCE9DE] px-2.5 py-1 rounded-full border border-[#5E8C61]/20 truncate max-w-[140px]">
                        {doc.category}
                      </span>
                    </div>

                    {/* Document Title */}
                    <div>
                      <h3 className="text-sm font-bold text-[#27332B] line-clamp-2 tracking-tight group-hover:text-[#2F4F3A] transition-colors">
                        {doc.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-[#6B7280] font-medium mt-1">
                        <span>{doc.fileSize}</span>
                        <span>•</span>
                        <span>{doc.uploadedAt}</span>
                      </div>
                      {doc.clientName && isClientRole && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#2F4F3A] font-bold mt-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5E8C61] shrink-0" />
                          <span className="truncate">Sent to: {doc.clientName}</span>
                        </div>
                      )}
                      {!isClientRole && (
                        <div className="mt-1.5">
                          <select
                            value={doc.clientId || ''}
                            onChange={(e) => handleAssignClient(doc.id, e.target.value, doc.name)}
                            className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61] cursor-pointer"
                          >
                            <option value="">{doc.clientName ? `Sent to: ${doc.clientName}` : '-- Select Client --'}</option>
                            {clientList.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions & Security Stamp */}
                  <div className="pt-3 border-t border-[#E3E8E3] flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[#4CAF50] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Encrypted
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPreview(doc)}
                        title="Preview Document"
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#27332B] hover:bg-[#EEF5EF] transition-colors"
                      >
                        <Eye className="w-4 h-4 text-[#5E8C61]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.id, doc.name)}
                        title="Download Encrypted File"
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#2F4F3A] hover:bg-[#EEF5EF] transition-colors"
                      >
                        <Download className="w-4 h-4 text-[#2F4F3A]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(doc)}
                        title="Delete Vault Document"
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Card */}
      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this document?"
        message={
          <>
            <span className="font-semibold">"{confirmDelete?.name}"</span> will be removed from the vault.
          </>
        }
        isLoading={isDeleting}
        onConfirm={() => confirmDelete && handleDeleteDocument(confirmDelete.id, confirmDelete.name)}
      />

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)} />
          <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E3E8E3] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#27332B]">Upload Vault Document</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Send the file to the selected client's portal</p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Input Box */}
              <label className="border-2 border-dashed border-[#5E8C61]/40 bg-[#EEF5EF]/30 rounded-xl p-6 flex flex-col items-center text-center space-y-2 cursor-pointer hover:border-[#5E8C61] transition-all">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSelectedFile(f);
                      if (!uploadForm.name) {
                        setUploadForm((prev) => ({ ...prev, name: f.name.replace(/\.[^/.]+$/, '') }));
                      }
                    }
                  }}
                />
                <Upload className="w-8 h-8 text-[#5E8C61]" />
                <div className="text-xs font-bold text-[#27332B]">
                  {selectedFile ? `File Selected: ${selectedFile.name}` : 'Click or Drag & drop local file here to browse'}
                </div>
                <div className="text-[10px] text-[#6B7280]">Supports PDF, XLSX, DOCX, PNG (Max 25MB)</div>
              </label>

              <Input
                label="Document Title"
                placeholder="e.g. FY24 Tax Audit Summary Sheet"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                required
              />

              {!isClientRole && (
                <div>
                <label className="block text-xs font-semibold text-[#27332B] mb-1.5">Send To Client <span className="text-rose-500">*</span></label>
                <select
                  value={uploadClientId}
                  onChange={(e) => setUploadClientId(e.target.value)}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                >
                  <option value="">-- Select Client (required) --</option>
                  {clientList.length === 0 && <option value="" disabled>No clients available</option>}
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#6B7280] mt-1">The selected client will see this document on their portal.</p>
              </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#27332B] mb-1.5">Vault Category</label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as any })}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                  >
                    <option value="GST & Tax Filings">GST & Tax Filings</option>
                    <option value="Audit & Financials">Audit & Financials</option>
                    <option value="Corporate Legal">Corporate Legal</option>
                    <option value="Agreements">Agreements</option>
                    <option value="Bank Statements">Bank Statements</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#27332B] mb-1.5">File Format</label>
                  <select
                    value={uploadForm.fileType}
                    onChange={(e) => setUploadForm({ ...uploadForm, fileType: e.target.value as any })}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                  >
                    <option value="pdf">PDF Document (.pdf)</option>
                    <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
                    <option value="docx">Word Document (.docx)</option>
                    <option value="png">Image Asset (.png)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-[#E3E8E3]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUploading}
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-5 py-2 text-xs font-semibold"
                >
                  Encrypt & Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedPreview(null)} />
          <div className="relative z-10 bg-white rounded-[20px] p-5 md:p-8 max-w-2xl w-full shadow-2xl border border-[#E3E8E3] animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-4 gap-3">
              <div className="min-w-0">
                <span className="inline-block bg-[#DCE9DE] text-[#2F4F3A] font-bold text-xs px-3 py-1 rounded-full border border-[#5E8C61]/20">
                  {selectedPreview.category}
                </span>
                <h3 className="text-xl font-bold text-[#27332B] mt-1 truncate">{selectedPreview.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Content Viewer */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-[#27332B]">
              <div className="p-5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {selectedPreview.contentSnippet}
              </div>

              <div className="border-t border-[#E3E8E3] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#6B7280] font-semibold block">Uploaded By</span>
                  <span className="font-bold text-[#27332B]">{selectedPreview.uploadedBy}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold block">Sent To Client</span>
                  <span className="font-bold text-[#27332B]">{selectedPreview.clientName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-[#6B7280] font-semibold block">Encryption Standard</span>
                  <span className="font-bold text-[#4CAF50] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    256-bit AES Encrypted
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-[#E3E8E3]">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
                className="text-xs w-full sm:w-auto"
              >
                Print File
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPreview(null)}
                  className="text-xs flex-1 sm:flex-none"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    handleDownload(selectedPreview.id, selectedPreview.name);
                    setSelectedPreview(null);
                  }}
                  leftIcon={<Download className="w-4 h-4" />}
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs flex-1 sm:flex-none"
                >
                  Download Encrypted File
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
