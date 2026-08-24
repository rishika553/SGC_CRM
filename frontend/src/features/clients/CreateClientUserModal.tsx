import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Lock, UserCheck, KeyRound, Building2, Copy, Check, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/axios';
import { formatName } from '@/lib/utils';

interface CreateClientUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientEmail?: string;
  onSuccess?: () => void;
}

interface CreateClientUserForm {
  client_name: string;
  first_name: string;
  last_name: string;
  username_or_email: string;
  password: string;
  job_title?: string;
}

interface ProvisionedDetails {
  clientName: string;
  stakeholderName: string;
  username: string;
  password: string;
}

export const CreateClientUserModal: React.FC<CreateClientUserModalProps> = ({
  isOpen,
  onClose,
  clientName = '',
  clientEmail = '',
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [provisionedData, setProvisionedData] = useState<ProvisionedDetails | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<CreateClientUserForm>();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setProvisionedData(null);
      setIsCopied(false);
      if (clientName) {
        setValue('client_name', clientName);
      }
      if (clientEmail) {
        setValue('username_or_email', clientEmail);
      }
    }
  }, [isOpen, clientName, clientEmail, setValue]);

  const onSubmit = async (data: CreateClientUserForm) => {
    setIsLoading(true);
    try {
      const response = await api.post('/clients/provision-account', {
        client_name: data.client_name,
        first_name: data.first_name,
        last_name: data.last_name,
        username_or_email: data.username_or_email,
        password: data.password,
        job_title: data.job_title || 'Client Stakeholder',
      });

      if (response.data.success) {
        toast('Client Account Provisioned', 'Account created successfully. Hand over these credentials to the client.', 'success');
        setProvisionedData({
          clientName: data.client_name,
          stakeholderName: formatName(data.first_name, data.last_name),
          username: data.username_or_email,
          password: data.password,
        });
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Failed to provision client credentials';
      toast('Provisioning Failed', typeof errorMsg === 'string' ? errorMsg : 'Check your inputs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!provisionedData) return;
    const text = `SGC CRM Client Credentials\n--------------------------\nClient: ${provisionedData.clientName}\nStakeholder: ${provisionedData.stakeholderName}\nUsername/Email: ${provisionedData.username}\nPassword: ${provisionedData.password}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast('Copied!', 'Client credentials copied to clipboard', 'info');
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleClose = () => {
    reset();
    setProvisionedData(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={provisionedData ? "Client Credentials Ready" : "Create Client Account"}
      description={
        provisionedData
          ? "The client account has been created. Copy these credentials and share them with your client."
          : "Enter client company details, stakeholder contact info, and login credentials in one place."
      }
      size="lg"
    >
      {provisionedData ? (
        <div className="space-y-5">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-emerald-900">Account Successfully Created!</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                The client stakeholder can now log in at <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-900">{window.location.origin}/client/login</code> using the credentials below.
              </p>
            </div>
          </div>

          <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-surface-200">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Client Company</span>
              <span className="text-sm font-bold text-surface-900">{provisionedData.clientName}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-surface-200">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Stakeholder Name</span>
              <span className="text-sm font-medium text-surface-900">{provisionedData.stakeholderName}</span>
            </div>

            <div className="flex items-center justify-between gap-2 pb-2 border-b border-surface-200">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider shrink-0">Login Username / Email</span>
              <span className="text-sm font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded min-w-0 truncate">
                {provisionedData.username}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider shrink-0">Login Password</span>
              <span className="text-sm font-mono font-bold text-surface-900 bg-surface-200 px-2 py-0.5 rounded min-w-0 truncate">
                {provisionedData.password}
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-brand-600" />}
              onClick={handleCopyCredentials}
            >
              {isCopied ? 'Credentials Copied!' : 'Copy Credentials to Clipboard'}
            </Button>

            <Button variant="primary" size="sm" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-brand-900 text-xs flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unified Client Account Creation</p>
              <p className="text-brand-700 mt-0.5">
                Set up client company details, stakeholder contact info, and login credentials all in one step. Give these credentials to the client for login at <code className="bg-brand-100 px-1 py-0.5 rounded font-mono text-[11px]">/client/login</code>.
              </p>
            </div>
          </div>

          <Input
            label="Client / Company Name"
            placeholder="e.g. Acme Global Industries"
            leftIcon={<Building2 className="w-4 h-4" />}
            error={errors.client_name?.message}
            {...register('client_name', { required: 'Client company name is required' })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Stakeholder First Name"
              placeholder="e.g. Sarah"
              error={errors.first_name?.message}
              {...register('first_name', { required: 'First name is required' })}
            />
            <Input
              label="Stakeholder Last Name (Optional)"
              placeholder="e.g. Jenkins"
              error={errors.last_name?.message}
              {...register('last_name')}
            />
            <Input
              label="Login Username or Email"
              placeholder="e.g. sarah_acme or sarah@acme.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.username_or_email?.message}
              {...register('username_or_email', { required: 'Login username or email is required' })}
            />
            <Input
              label="Client Login Password"
              type="password"
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
            />
          </div>

          <Input
            label="Job Title / Designation (Optional)"
            placeholder="e.g. VP of Procurement"
            {...register('job_title')}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
            <Button variant="outline" size="sm" type="button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              leftIcon={<UserCheck className="w-4 h-4" />}
              isLoading={isLoading}
            >
              Create Client Account
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

