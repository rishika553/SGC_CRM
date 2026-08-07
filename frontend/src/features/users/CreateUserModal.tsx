import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Lock, User as UserIcon, Briefcase } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Role } from '@/types';
import { api } from '@/lib/axios';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateUserForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  job_title?: string;
  role_id: string;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateUserForm>();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      api.get('/roles').then((res) => {
        if (res.data.success) {
          setRoles(res.data.data);
        }
      });
    }
  }, [isOpen]);

  const onSubmit = async (data: CreateUserForm) => {
    setIsLoading(true);
    try {
      await api.post('/users', data);
      toast('Success', `User account for ${data.email} created`, 'success');
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('Creation Failed', err.response?.data?.error?.message || 'Failed to create user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Consultant / User"
      description="Create a new team account and assign system access role permissions."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            placeholder="John"
            error={errors.first_name?.message}
            {...register('first_name', { required: 'First name is required' })}
          />
          <Input
            label="Last Name"
            placeholder="Doe"
            error={errors.last_name?.message}
            {...register('last_name', { required: 'Last name is required' })}
          />
          <Input
            label="Corporate Email"
            type="email"
            placeholder="john.doe@firm.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email', { required: 'Email address is required' })}
          />
          <Input
            label="Initial Password"
            type="password"
            placeholder="••••••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            {...register('password', {
              required: 'Initial password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            })}
          />
          <Input
            label="Job Title"
            placeholder="e.g. Senior Cloud Consultant"
            leftIcon={<Briefcase className="w-4 h-4" />}
            {...register('job_title')}
          />

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
              Assigned Role
            </label>
            <select
              className="w-full h-9 bg-white border border-surface-200 rounded-lg px-3 text-sm text-surface-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
              {...register('role_id', { required: 'Role selection is required' })}
            >
              <option value="">Select system role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name} ({r.name})
                </option>
              ))}
            </select>
            {errors.role_id && <span className="text-xs font-medium text-red-600">{errors.role_id.message}</span>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Create User Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};
