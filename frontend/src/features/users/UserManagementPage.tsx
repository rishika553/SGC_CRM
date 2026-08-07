import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Plus, Trash2, Edit, Shield, ChevronLeft, ChevronRight, KeyRound } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { CreateUserModal } from './CreateUserModal';
import { EditUserDrawer } from './EditUserDrawer';
import { CreateClientUserModal } from '@/features/clients/CreateClientUserModal';
import { User, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/axios';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, page_size: 20, total_pages: 1, has_next: false, has_previous: false });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateClientUserOpen, setIsCreateClientUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchUsers = useCallback(async (page: number = 1, searchQuery: string = '') => {
    setIsLoading(true);
    try {
      const response = await api.get<PaginatedResponse<User>>('/users', {
        params: { page, page_size: 20, search: searchQuery || undefined },
      });
      if (response.data.success) {
        setUsers(response.data.data);
        setMeta(response.data.meta);
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to load user directory', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers(1, search);
  }, [fetchUsers, search]);

  const handleDeleteUser = async (userToDelete: User) => {
    if (!window.confirm(`Are you sure you want to delete ${userToDelete.first_name} ${userToDelete.last_name}?`)) {
      return;
    }
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast('Deleted', 'User soft-deleted successfully', 'success');
      fetchUsers(meta.page, search);
    } catch (err: any) {
      toast('Delete Failed', err.response?.data?.error?.message || 'Could not delete user', 'error');
    }
  };

  return (
    <MainLayout user={currentUser || undefined}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600" />
              <h1 className="text-xl font-bold text-surface-900 tracking-tight">Team Directory & Access</h1>
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Manage firm consultants, administrative roles, and organization accounts
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<KeyRound className="w-4 h-4 text-brand-600" />}
              onClick={() => setIsCreateClientUserOpen(true)}
            >
              Provision Client Account
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Add Team Member
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <Card padding="sm">
          <div className="flex items-center justify-between gap-4">
            <div className="w-72">
              <Input
                placeholder="Search by name or email..."
                leftIcon={<Search className="w-4 h-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-xs text-surface-500 font-medium">
              Showing {users.length} of {meta.total} registered users
            </span>
          </div>
        </Card>

        {/* Table View */}
        {isLoading ? (
          <Card padding="md" className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ) : users.length === 0 ? (
          <EmptyState
            title="No Users Found"
            description="No team members match your current search query."
            actionLabel="Add Team Member"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant User</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-semibold text-xs flex items-center justify-center border border-brand-200">
                          {u.first_name[0]}
                          {u.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-surface-900">
                            {u.first_name} {u.last_name}
                          </div>
                          <div className="text-[11px] text-surface-500">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{u.job_title || 'Consultant'}</TableCell>
                    <TableCell>
                      <Badge variant="primary">{u.role?.display_name || u.role?.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'success' : 'danger'}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setIsEditOpen(true);
                          }}
                          className="p-1.5 text-surface-500 hover:text-brand-600 hover:bg-surface-100 rounded-md transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 text-surface-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-3.5 border-t border-surface-100 flex items-center justify-between text-xs text-surface-600">
              <span>
                Page {meta.page} of {meta.total_pages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!meta.has_previous}
                  onClick={() => fetchUsers(meta.page - 1, search)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!meta.has_next}
                  onClick={() => fetchUsers(meta.page + 1, search)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Modals & Drawers */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => fetchUsers(meta.page, search)}
      />

      <EditUserDrawer
        user={selectedUser}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => fetchUsers(meta.page, search)}
      />

      <CreateClientUserModal
        isOpen={isCreateClientUserOpen}
        clientName="Client Organization"
        onClose={() => setIsCreateClientUserOpen(false)}
        onSuccess={() => fetchUsers(meta.page, search)}
      />
    </MainLayout>
  );
};
