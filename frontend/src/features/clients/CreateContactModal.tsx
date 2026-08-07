import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Phone, User, Briefcase } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/axios';

interface CreateContactModalProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateContactForm {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department?: string;
  is_primary_contact: boolean;
}

export const CreateContactModal: React.FC<CreateContactModalProps> = ({
  clientId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateContactForm>();
  const { toast } = useToast();

  const onSubmit = async (data: CreateContactForm) => {
    setIsLoading(true);
    try {
      await api.post('/contacts', { ...data, client_id: clientId });
      toast('Success', `Contact ${data.first_name} ${data.last_name} added`, 'success');
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('Failed', err.response?.data?.error?.message || 'Failed to add contact', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact Stakeholder"
      description="Register key client executive or stakeholder decision maker."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            placeholder="Jane"
            error={errors.first_name?.message}
            {...register('first_name', { required: 'First name is required' })}
          />
          <Input
            label="Last Name"
            placeholder="Smith"
            error={errors.last_name?.message}
            {...register('last_name', { required: 'Last name is required' })}
          />
          <Input
            label="Direct Email"
            type="email"
            placeholder="jane.smith@client.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
          <Input
            label="Phone Number"
            placeholder="+1 (555) 019-2834"
            leftIcon={<Phone className="w-4 h-4" />}
            {...register('phone')}
          />
          <Input
            label="Job Title"
            placeholder="VP of IT & Digital Transformation"
            leftIcon={<Briefcase className="w-4 h-4" />}
            {...register('job_title')}
          />
          <Input
            label="Department"
            placeholder="Information Technology"
            {...register('department')}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="is_primary"
            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            {...register('is_primary_contact')}
          />
          <label htmlFor="is_primary" className="text-xs font-semibold text-surface-700 cursor-pointer">
            Mark as Primary Client Stakeholder
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Add Stakeholder
          </Button>
        </div>
      </form>
    </Modal>
  );
};
