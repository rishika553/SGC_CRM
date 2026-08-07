import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Building2, Globe, MapPin, IndianRupee } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ClientTier, ClientStatus } from '@/types/client';
import { api } from '@/lib/axios';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateClientForm {
  name: string;
  industry?: string;
  company_size?: string;
  website?: string;
  billing_address?: string;
  annual_revenue?: number;
  tier: ClientTier;
  status: ClientStatus;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateClientForm>({
    defaultValues: {
      tier: 'mid_market',
      status: 'prospect',
    },
  });
  const { toast } = useToast();

  const onSubmit = async (data: CreateClientForm) => {
    setIsLoading(true);
    try {
      const payload: Record<string, any> = {};
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== '' && !Number.isNaN(val)) {
          payload[key] = val;
        }
      });
      await api.post('/clients', payload);
      toast('Success', `Client company account "${data.name}" created`, 'success');
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ')
          : typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : 'Failed to create client account');
      toast('Creation Failed', errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Corporate Client Account"
      description="Enter corporate client company details and strategic tier level."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            placeholder="e.g. Acme Financial Group"
            leftIcon={<Building2 className="w-4 h-4" />}
            error={errors.name?.message}
            {...register('name', { required: 'Company name is required' })}
          />

          <Input
            label="Industry Sector"
            placeholder="e.g. Banking & Capital Markets"
            {...register('industry')}
          />

          <Input
            label="Website Domain"
            placeholder="https://acmeglobal.com"
            leftIcon={<Globe className="w-4 h-4" />}
            {...register('website')}
          />

          <Input
            label="Estimated Annual Revenue (₹)"
            type="number"
            placeholder="5000000"
            leftIcon={<IndianRupee className="w-4 h-4" />}
            {...register('annual_revenue', { valueAsNumber: true })}
          />

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
              Client Tier Level
            </label>
            <select
              className="w-full h-9 bg-white border border-surface-200 rounded-lg px-3 text-sm text-surface-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
              {...register('tier')}
            >
              <option value="enterprise">Enterprise Tier</option>
              <option value="mid_market">Mid-Market Tier</option>
              <option value="smb">SMB Tier</option>
            </select>
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
              Account Status
            </label>
            <select
              className="w-full h-9 bg-white border border-surface-200 rounded-lg px-3 text-sm text-surface-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
              {...register('status')}
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active Client</option>
              <option value="churned">Churned / Inactive</option>
            </select>
          </div>
        </div>

        <Input
          label="Corporate HQ Billing Address"
          placeholder="Street address, City, State, Country"
          leftIcon={<MapPin className="w-4 h-4" />}
          {...register('billing_address')}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Create Client Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};
