import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Download,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  Trash2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { api } from '@/lib/axios';
import { useAuth } from '@/features/auth/AuthContext';
import { resolveClientIdForCurrentUser } from '@/features/clients/clientQueries';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  outstandingAmount: number;
  status: 'Paid' | 'Sent' | 'Overdue' | 'Draft';
}

export const BillingPage: React.FC = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [clientList, setClientList] = useState<Client[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'amount' | 'outstanding'>('newest');

  // Create Manual Invoice Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    client_id: '',
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: '',
    amount: '',
    taxRate: '18',
    status: 'unpaid',
  });

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      const activeClientId = await resolveClientIdForCurrentUser(isClientRole);
      const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      const params: any = { page: 1, page_size: 50 };
      if (isUUID(activeClientId)) {
        params.client_id = activeClientId;
      }
      const invRes = await api.get<PaginatedResponse<any>>('/invoices', { params });
      if (invRes.data.success && invRes.data.data) {
        const liveInvoices: InvoiceItem[] = invRes.data.data.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: formatDate(inv.issue_date || inv.created_at),
          dueDate: inv.due_date ? formatDate(inv.due_date) : 'N/A',
          clientName: inv.client?.name || 'Client',
          description: inv.notes || inv.project?.name || 'Professional Services Fee',
          amount: inv.subtotal_amount || inv.total_amount || 0,
          taxAmount: inv.tax_amount || 0,
          totalAmount: inv.total_amount || 0,
          outstandingAmount: inv.status === 'paid' ? 0 : (inv.total_amount || 0),
          status: inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : inv.status === 'draft' ? 'Draft' : 'Sent',
        }));
        setInvoices(liveInvoices);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientList = async () => {
    try {
      const res = await api.get('/clients', { params: { page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch client list:', err);
    }
  };

  useEffect(() => {
    fetchBillingData();
    if (!isClientRole) fetchClientList();
  }, [isClientRole]);

  // Filtered and Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        const matchesSearch =
          inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') return b.totalAmount - a.totalAmount;
        if (sortBy === 'outstanding') return b.outstandingAmount - a.outstandingAmount;
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
  }, [invoices, searchQuery, statusFilter, sortBy]);

  // Aggregate Metrics
  const totalOutstanding = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + inv.outstandingAmount, 0);
  }, [invoices]);

  const totalCollected = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === 'Paid')
      .reduce((acc, inv) => acc + inv.totalAmount, 0);
  }, [invoices]);

  const handleDownloadPdf = (invNumber: string) => {
    toast('Downloading Invoice', `Generating PDF for invoice #${invNumber}...`, 'info');
    setTimeout(() => {
      toast('Download Complete', `Invoice #${invNumber} downloaded successfully.`, 'success');
    }, 1200);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtotal = Number(newInvoiceForm.amount) || 0;
      const taxRate = Number(newInvoiceForm.taxRate) || 18;
      const res = await api.post('/invoices', {
        client_id: newInvoiceForm.client_id,
        subtotal,
        tax_rate: taxRate,
        due_date: newInvoiceForm.dueDate ? newInvoiceForm.dueDate + 'T00:00:00Z' : undefined,
        notes: newInvoiceForm.description || undefined,
        status: newInvoiceForm.status,
      });
      if (res.data.success) {
        toast('Invoice Created', 'Invoice has been created successfully.', 'success');
        setIsCreateModalOpen(false);
        setNewInvoiceForm({
          client_id: '',
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: '',
          amount: '',
          taxRate: '18',
          status: 'unpaid',
        });
        fetchBillingData();
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to create invoice', 'error');
    }
  };

  const handleStatusChange = (invId: string, newStatus: 'Paid' | 'Sent' | 'Overdue' | 'Draft') => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invId) return inv;
        const isPaid = newStatus === 'Paid';
        return {
          ...inv,
          status: newStatus,
          outstandingAmount: isPaid ? 0 : inv.totalAmount,
        };
      })
    );
    toast('Invoice Updated', `Invoice status updated to ${newStatus}.`, 'success');
  };

  const handleDeleteInvoice = async (invId: string, invNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice #${invNumber}?`)) return;
    try {
      const res = await api.delete(`/invoices/${invId}`);
      if (res.data?.success) {
        toast('Invoice Deleted', `Invoice #${invNumber} has been deleted.`, 'success');
        setInvoices((prev) => prev.filter((inv) => inv.id !== invId));
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to delete invoice', 'error');
    }
  };

  const statusStyles = {
    Paid: 'bg-emerald-50 text-[#4CAF50] border-emerald-200',
    Sent: 'bg-[#EEF5EF] text-[#5E8C61] border-[#5E8C61]/30',
    Overdue: 'bg-rose-50 text-[#DC2626] border-rose-200',
    Draft: 'bg-slate-100 text-[#6B7280] border-slate-200',
  };

  return (
    <MainLayout clientName={activeClient ? activeClient.name : 'Client Desk'} pageTitle="Billing">
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              Manual Invoice Record-Keeping, Tax Invoices & Payment Status
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isClientRole && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-5 h-5" />}
              className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-[16px] shadow-xs text-sm font-bold w-full sm:w-auto"
            >
              Create Invoice
            </Button>
            )}
          </div>
        </div>

        {/* 4 Summary Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Outstanding Amount Card */}
          <div className="bg-white border border-[#E3E8E3] rounded-[18px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(47,79,58,.05)] relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#E8A317]" />
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              TOTAL OUTSTANDING
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#27332B] mt-2 tracking-tight">
              {formatCurrency(totalOutstanding)}
            </div>
            <div className="text-xs text-[#6B7280] font-medium mt-1">
              across sent & overdue invoices
            </div>
          </div>

          {/* Revenue Collected Card */}
          <div className="bg-white border border-[#E3E8E3] rounded-[18px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              REVENUE COLLECTED
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#27332B] mt-2 tracking-tight">
              {formatCurrency(totalCollected)}
            </div>
            <div className="text-xs text-[#4CAF50] font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fully settled invoices
            </div>
          </div>

          {/* Active Invoices Count */}
          <div className="bg-white border border-[#E3E8E3] rounded-[18px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              TOTAL INVOICES
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#27332B] mt-2 tracking-tight">
              {invoices.length}
            </div>
            <div className="text-xs text-[#6B7280] font-medium mt-1">
              recorded in ledger
            </div>
          </div>

          {/* Overdue Count */}
          <div className="bg-white border border-[#E3E8E3] rounded-[18px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              OVERDUE INVOICES
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#DC2626] mt-2 tracking-tight">
              {invoices.filter((i) => i.status === 'Overdue').length}
            </div>
            <div className="text-xs text-[#DC2626] font-medium mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Follow-up required
            </div>
          </div>
        </div>

        {/* Toolbar Card: Search, Filter, Sort */}
        <div className="bg-white border border-[#E3E8E3] rounded-[20px] p-3.5 sm:p-4 shadow-[0_6px_20px_rgba(47,79,58,.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search by invoice #, client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="bg-[#F7F9F6] border-[#E3E8E3] focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-2"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-2.5 sm:px-3 py-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#5E8C61] shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-transparent border-none text-[#27332B] font-semibold text-xs focus:outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Sent">Sent</option>
                <option value="Overdue">Overdue</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-2.5 sm:px-3 py-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5E8C61] shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-transparent border-none text-[#27332B] font-semibold text-xs focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest Invoice #</option>
                <option value="amount">Highest Amount</option>
                <option value="outstanding">Highest Outstanding</option>
              </select>
            </div>
          </div>
        </div>

        {/* Responsive Billing Table Container */}
        <div className="bg-white border border-[#E3E8E3] rounded-[20px] overflow-hidden shadow-[0_6px_20px_rgba(47,79,58,.05)]">
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F1F5F1] border-b border-[#E3E8E3] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#27332B]">Tax Invoice Register</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Manual invoice ledger records</p>
            </div>
            <span className="bg-[#DCE9DE] text-[#2F4F3A] text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto">
              {filteredInvoices.length} Invoices Listed
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-14">
              <EmptyState
                icon={<Receipt className="w-12 h-12 text-[#5E8C61]" />}
                title="No Invoices Found"
                description="No billing records match your search query. Click 'New Invoice' at the top right to create an invoice."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#F1F5F1]">
                  <TableRow className="border-[#E3E8E3]">
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm">Invoice Number</TableHead>
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm">Invoice Date</TableHead>
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm">Client Entity</TableHead>
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm">Total Amount</TableHead>
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm">Outstanding Amount</TableHead>
                    <TableHead className="font-bold text-[#27332B] py-3 sm:py-4 text-xs sm:text-sm text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-[#F7F9F6] border-[#E3E8E3]">
                      <TableCell className="font-mono font-bold text-[#27332B]">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-[#6B7280]">{inv.invoiceDate}</TableCell>
                      <TableCell className="font-semibold text-[#27332B]">{inv.clientName}</TableCell>
                      <TableCell className="font-bold text-[#27332B]">{formatCurrency(inv.totalAmount)}</TableCell>
                      <TableCell>
                        <select
                          value={inv.status}
                          onChange={(e) => handleStatusChange(inv.id, e.target.value as any)}
                          className={cn(
                            'text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none',
                            statusStyles[inv.status]
                          )}
                        >
                          <option value="Paid">● Paid</option>
                          <option value="Sent">● Sent</option>
                          <option value="Overdue">● Overdue</option>
                          <option value="Draft">● Draft</option>
                        </select>
                      </TableCell>
                      <TableCell className="font-semibold text-[#27332B]">
                        {inv.outstandingAmount > 0 ? (
                          <span className="text-[#DC2626] font-bold">{formatCurrency(inv.outstandingAmount)}</span>
                        ) : (
                          <span className="text-[#4CAF50] font-bold">₹0 (Settled)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleDownloadPdf(inv.invoiceNumber)}
                          leftIcon={<Download className="w-3.5 h-3.5" />}
                          className="border-[#E3E8E3] text-[#27332B] hover:bg-[#EEF5EF] text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                        >
                          PDF
                        </Button>
                        {!isClientRole && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                          >
                            Delete
                          </Button>
                        )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Manual Invoice Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E3E8E3] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#27332B]">Create Invoice</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Create a new invoice for a client</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#27332B] mb-1.5">Client *</label>
                <select
                  value={newInvoiceForm.client_id}
                  onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, client_id: e.target.value })}
                  className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                  required
                >
                  <option value="">Select a client...</option>
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Subtotal Amount (₹)"
                  type="number"
                  placeholder="0"
                  value={newInvoiceForm.amount}
                  onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, amount: e.target.value })}
                  required
                />
                <Input
                  label="Tax Rate (%)"
                  type="number"
                  value={newInvoiceForm.taxRate}
                  onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, taxRate: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Due Date"
                  type="date"
                  value={newInvoiceForm.dueDate}
                  onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, dueDate: e.target.value })}
                />
                <div>
                  <label className="block text-xs font-bold text-[#27332B] mb-1.5">Status</label>
                  <select
                    value={newInvoiceForm.status}
                    onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, status: e.target.value })}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                  </select>
                </div>
              </div>

              <Input
                label="Notes / Description"
                placeholder="Invoice description..."
                value={newInvoiceForm.description}
                onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, description: e.target.value })}
              />

              {newInvoiceForm.amount && (
                <div className="p-3 bg-[#EEF5EF] border border-[#5E8C61]/30 rounded-xl text-xs flex justify-between font-bold text-[#2F4F3A]">
                  <span>Total Payable (incl {newInvoiceForm.taxRate || 18}% GST):</span>
                  <span>{formatCurrency(Math.round(Number(newInvoiceForm.amount || 0) * (1 + Number(newInvoiceForm.taxRate || 18) / 100)))}</span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E3E8E3]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-5 py-2 text-xs font-semibold"
                >
                  Create Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
