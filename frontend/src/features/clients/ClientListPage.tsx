import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Search, Plus, ExternalLink, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Trash2, Loader2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { CreateClientModal } from './CreateClientModal';
import { DeleteClientModal } from './DeleteClientModal';
import { CreateClientUserModal } from './CreateClientUserModal';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';
import { formatCurrency, formatName } from '@/lib/utils';
import { api } from '@/lib/axios';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const ClientListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const canDelete = user?.role?.name === 'super_admin';

  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState({
    total: 0, page: 1, page_size: 20, total_pages: 1,
    has_next: false, has_previous: false,
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchClients = useCallback(async (page: number = 1) => {
    setIsFetching(true);
    try {
      const response = await api.get<PaginatedResponse<Client>>('/clients', {
        params: {
          page,
          page_size: pageSize,
          search: debouncedSearch || undefined,
          tier: tierFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      if (response.data.success) {
        setClients(response.data.data);
        setMeta(response.data.meta);
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to load client directory', 'error');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [debouncedSearch, tierFilter, statusFilter, pageSize, toast]);

  useEffect(() => {
    fetchClients(1);
  }, [fetchClients]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= meta.total_pages) fetchClients(page);
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    const tp = meta.total_pages;
    const cp = meta.page;
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cp > 3) pages.push('...');
      const start = Math.max(2, cp - 1);
      const end = Math.min(tp - 1, cp + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (cp < tp - 2) pages.push('...');
      pages.push(tp);
    }
    return pages;
  }, [meta.page, meta.total_pages]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise': return <Badge variant="primary">Enterprise</Badge>;
      case 'mid_market': return <Badge variant="info">Mid-Market</Badge>;
      default: return <Badge variant="default">SMB</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'prospect': return <Badge variant="warning">Prospect</Badge>;
      case 'inactive': return <Badge variant="default">Inactive</Badge>;
      case 'on_hold': return <Badge variant="info">On Hold</Badge>;
      case 'archived': return <Badge variant="default">Archived</Badge>;
      default: return <Badge variant="danger">Churned</Badge>;
    }
  };

  return (
    <MainLayout user={user || undefined}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-surface-500 mt-0.5">
              Manage enterprise accounts, key decision-makers, and strategic client tiers
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsProvisionOpen(true)}
            >
              Create Account
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card padding="sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-80 relative">
              <Input
                placeholder="Search by name, email, phone, city, GST, PAN..."
                leftIcon={<Search className="w-4 h-4" />}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 animate-spin" />
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
              <select
                className="h-9 bg-white border border-surface-200 rounded-lg px-3 text-xs font-medium text-surface-800 focus:outline-none focus:border-brand-600 flex-1 sm:flex-none min-w-0"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="">All Tiers</option>
                <option value="enterprise">Enterprise</option>
                <option value="mid_market">Mid-Market</option>
                <option value="smb">SMB</option>
              </select>

              <select
                className="h-9 bg-white border border-surface-200 rounded-lg px-3 text-xs font-medium text-surface-800 focus:outline-none focus:border-brand-600 flex-1 sm:flex-none min-w-0"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="inactive">Inactive</option>
                <option value="on_hold">On Hold</option>
                <option value="churned">Churned</option>
                <option value="archived">Archived</option>
              </select>

              <select
                className="h-9 bg-white border border-surface-200 rounded-lg px-3 text-xs font-medium text-surface-800 focus:outline-none focus:border-brand-600 flex-1 sm:flex-none min-w-0"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} / page</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Table */}
        {isLoading ? (
          <Card padding="md" className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : clients.length === 0 ? (
          <EmptyState
            title="No Client Accounts Found"
            description={debouncedSearch ? `No results for "${debouncedSearch}". Try a different search term.` : 'No corporate client records match your filter criteria.'}
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company & Industry</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Client Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Account Lead</TableHead>
                    <TableHead>Est. Revenue</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => navigate(`/clients/${c.id}`)}
                          className="text-left group"
                        >
                          <div className="font-semibold text-surface-900 group-hover:text-brand-600 transition-colors">{c.name}</div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-surface-700">{c.email || '—'}</div>
                        <div className="text-[11px] text-surface-500">{c.phone || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-surface-700">{c.city || '—'}</div>
                        <div className="text-[11px] text-surface-500">{c.state || ''}</div>
                      </TableCell>
                      <TableCell>{getTierBadge(c.tier)}</TableCell>
                      <TableCell>{getStatusBadge(c.status)}</TableCell>
                      <TableCell>
                        {c.account_manager ? formatName(c.account_manager.first_name, c.account_manager.last_name) : 'Unassigned'}
                      </TableCell>
                      <TableCell className="font-medium text-surface-900">
                        {c.annual_revenue ? formatCurrency(c.annual_revenue) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                            onClick={() => navigate(`/clients/${c.id}`)}
                          >
                            View
                          </Button>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setClientToDelete({ id: c.id, name: c.name })}
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

            {/* Pagination */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-surface-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-surface-600">
              <span>
                Showing {((meta.page - 1) * meta.page_size) + 1}–{Math.min(meta.page * meta.page_size, meta.total)} of {meta.total} clients
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline"
                  disabled={!meta.has_previous}
                  onClick={() => goToPage(1)}
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={!meta.has_previous}
                  onClick={() => goToPage(meta.page - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Prev
                </Button>

                {pageNumbers.map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="px-1.5 text-surface-400">...</span>
                  ) : (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === meta.page ? 'primary' : 'outline'}
                      onClick={() => goToPage(p as number)}
                      className="min-w-[32px] justify-center"
                    >
                      {p}
                    </Button>
                  )
                )}

                <Button
                  size="sm" variant="outline"
                  disabled={!meta.has_next}
                  onClick={() => goToPage(meta.page + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={!meta.has_next}
                  onClick={() => goToPage(meta.total_pages)}
                  title="Last page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <CreateClientModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => fetchClients(meta.page)}
      />

      <CreateClientUserModal
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        onSuccess={() => fetchClients(meta.page)}
      />

      <DeleteClientModal
        isOpen={!!clientToDelete}
        client={clientToDelete}
        onClose={() => setClientToDelete(null)}
        onSuccess={() => fetchClients(meta.page)}
      />
    </MainLayout>
  );
};
