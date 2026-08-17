import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Plus, ExternalLink, ChevronLeft, ChevronRight, Filter, Trash2, KeyRound } from 'lucide-react';
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
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/axios';

export const ClientListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const canDelete = user?.role?.name === 'super_admin';

  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, page_size: 20, total_pages: 1, has_next: false, has_previous: false });
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchClients = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const response = await api.get<PaginatedResponse<Client>>('/clients', {
        params: {
          page,
          page_size: 20,
          search: search || undefined,
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
    }
  }, [search, tierFilter, statusFilter, toast]);

  useEffect(() => {
    fetchClients(1);
  }, [fetchClients]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge variant="primary">Enterprise</Badge>;
      case 'mid_market':
        return <Badge variant="info">Mid-Market</Badge>;
      default:
        return <Badge variant="default">SMB</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'prospect':
        return <Badge variant="warning">Prospect</Badge>;
      default:
        return <Badge variant="danger">Churned</Badge>;
    }
  };

  return (
    <MainLayout user={user || undefined}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              <h1 className="text-xl font-bold text-surface-900 tracking-tight">Corporate Clients & Accounts</h1>
            </div>
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
            <div className="w-full md:w-72">
              <Input
                placeholder="Search clients by name or industry..."
                leftIcon={<Search className="w-4 h-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                <option value="churned">Churned</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Directory Table */}
        {isLoading ? (
          <Card padding="md" className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : clients.length === 0 ? (
          <EmptyState
            title="No Client Accounts Found"
            description="No corporate client records match your filter criteria."
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company & Industry</TableHead>
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
                      <div className="font-semibold text-surface-900">{c.name}</div>
                      <div className="text-[11px] text-surface-500">{c.industry || 'General Services'}</div>
                    </TableCell>
                    <TableCell>{getTierBadge(c.tier)}</TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell>
                      {c.account_manager ? `${c.account_manager.first_name} ${c.account_manager.last_name}` : 'Unassigned'}
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
                          View Account
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
                Page {meta.page} of {meta.total_pages} ({meta.total} clients)
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={!meta.has_previous}
                  onClick={() => fetchClients(meta.page - 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={!meta.has_next}
                  onClick={() => fetchClients(meta.page + 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
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
