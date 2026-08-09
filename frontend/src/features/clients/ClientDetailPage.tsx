import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Globe,
  MapPin,
  Users,
  MessageSquare,
  Plus,
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  Briefcase,
  Trash2,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Lock,
  UserCheck,
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
import { CreateContactModal } from './CreateContactModal';
import { LogCommunicationModal } from './LogCommunicationModal';
import { DeleteClientModal } from './DeleteClientModal';
import { CreateClientUserModal } from './CreateClientUserModal';
import { ClientDetail } from '@/types/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/axios';

export const ClientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'activity'>('overview');

  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isLogCommOpen, setIsLogCommOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isProvisionLoginOpen, setIsProvisionLoginOpen] = useState(false);

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
                <h1 className="text-xl font-bold text-surface-900 tracking-tight">{client.name}</h1>
                <p className="text-xs text-surface-500">{client.industry || 'Corporate Account'}</p>
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
              Provision Client Login
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddContactOpen(true)}
            >
              Add Contact
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<MessageSquare className="w-4 h-4" />}
              onClick={() => setIsLogCommOpen(true)}
            >
              Log Interaction
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete Profile
            </Button>
          </div>
        </div>

        {/* Account Summary Banner */}
        <Card padding="md">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <span className="text-xs font-medium text-surface-500 block">Account Tier</span>
              <Badge variant="primary" className="mt-1 uppercase">
                {client.tier}
              </Badge>
            </div>

            <div>
              <span className="text-xs font-medium text-surface-500 block">Account Status</span>
              <Badge variant={client.status === 'active' ? 'success' : 'warning'} className="mt-1 capitalize">
                {client.status}
              </Badge>
            </div>

            <div>
              <span className="text-xs font-medium text-surface-500 block">Account Manager</span>
              <span className="text-sm font-semibold text-surface-900 mt-1 block">
                {client.account_manager
                  ? `${client.account_manager.first_name} ${client.account_manager.last_name}`
                  : 'Unassigned'}
              </span>
            </div>

            <div>
              <span className="text-xs font-medium text-surface-500 block">Annual Revenue</span>
              <span className="text-sm font-bold text-surface-900 mt-1 block">
                {client.annual_revenue ? formatCurrency(client.annual_revenue) : '—'}
              </span>
            </div>
          </div>
        </Card>

        {/* Portal Access & Credentials Card */}
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
            <Card padding="md" className="space-y-4 border border-brand-300 bg-gradient-to-r from-brand-50/60 via-white to-emerald-50/40 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-600 text-white rounded-xl shadow-xs">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                      <span>Client Portal Account & Credentials</span>
                      <Badge variant="success" className="text-[10px]">Super Admin Managed</Badge>
                    </h3>
                    <p className="text-xs text-surface-500">Sign-in credentials and access controls for {client.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Copy className="w-4 h-4 text-brand-600" />}
                    onClick={handleCopyPortalInfo}
                  >
                    Copy Login Details
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<KeyRound className="w-4 h-4" />}
                    onClick={() => setIsProvisionLoginOpen(true)}
                  >
                    {clientUsername ? 'Set / Reset Password' : 'Provision Credentials'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-brand-100 text-xs">
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
            </Card>
          );
        })()}

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-200 gap-4 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Overview & Details
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'contacts'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Key Stakeholders ({client.contacts.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            Interaction History ({client.communication_logs.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <Card padding="md" className="space-y-4">
            <h3 className="text-sm font-bold text-surface-900">Company Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-surface-500 font-medium">Website:</span>
                <span className="text-surface-900 ml-2 font-semibold">{client.website || 'N/A'}</span>
              </div>
              <div>
                <span className="text-surface-500 font-medium">Company Size:</span>
                <span className="text-surface-900 ml-2 font-semibold">{client.company_size || 'N/A'}</span>
              </div>
              <div>
                <span className="text-surface-500 font-medium">HQ Address:</span>
                <span className="text-surface-900 ml-2 font-semibold">{client.billing_address || 'N/A'}</span>
              </div>
              <div>
                <span className="text-surface-500 font-medium">Created Date:</span>
                <span className="text-surface-900 ml-2 font-semibold">{formatDate(client.created_at)}</span>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'contacts' && (
          <Card padding="none">
            {client.contacts.length === 0 ? (
              <EmptyState
                title="No Contacts Registered"
                description="Add executive decision makers for this client company."
                actionLabel="Add Contact Stakeholder"
                onAction={() => setIsAddContactOpen(true)}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stakeholder Name</TableHead>
                    <TableHead>Title & Department</TableHead>
                    <TableHead>Contact Channels</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="font-semibold text-surface-900">
                          {contact.first_name} {contact.last_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{contact.job_title || 'Executive'}</div>
                        <div className="text-[11px] text-surface-500">{contact.department || 'Management'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-surface-700">
                          <Mail className="w-3.5 h-3.5 text-surface-400" />
                          <span>{contact.email}</span>
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-surface-500 text-[11px] mt-0.5">
                            <Phone className="w-3 h-3 text-surface-400" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.is_primary_contact ? (
                          <Badge variant="primary">Primary Stakeholder</Badge>
                        ) : (
                          <Badge variant="default">Contact</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {client.communication_logs.length === 0 ? (
              <EmptyState
                title="No Interaction History"
                description="No meeting minutes or phone call logs recorded for this account."
                actionLabel="Log Interaction Touchpoint"
                onAction={() => setIsLogCommOpen(true)}
              />
            ) : (
              client.communication_logs.map((log) => (
                <Card key={log.id} padding="sm" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="info" className="uppercase text-[10px]">
                        {log.type}
                      </Badge>
                      <h4 className="text-sm font-semibold text-surface-900">{log.subject}</h4>
                    </div>
                    <span className="text-[11px] text-surface-500">{formatDate(log.interaction_date)}</span>
                  </div>

                  <p className="text-xs text-surface-700 whitespace-pre-line bg-surface-50 p-3 rounded-lg border border-surface-100">
                    {log.notes}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-surface-500 pt-1">
                    <span>
                      Logged by:{' '}
                      <strong className="text-surface-800">
                        {log.logged_by.first_name} {log.logged_by.last_name}
                      </strong>
                    </span>
                    {log.contact && (
                      <span>
                        With stakeholder:{' '}
                        <strong className="text-surface-800">
                          {log.contact.first_name} {log.contact.last_name}
                        </strong>
                      </span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <CreateContactModal
        clientId={client.id}
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onSuccess={fetchClientDetails}
      />

      <LogCommunicationModal
        clientId={client.id}
        contacts={client.contacts}
        isOpen={isLogCommOpen}
        onClose={() => setIsLogCommOpen(false)}
        onSuccess={fetchClientDetails}
      />

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
