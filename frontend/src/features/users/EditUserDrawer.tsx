import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { User, Role } from '@/types';
import { api } from '@/lib/axios';

interface EditUserDrawerProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditUserForm {
  first_name: string;
  last_name: string;
  job_title?: string;
  phone_number?: string;
  is_active: boolean;
}

export const EditUserDrawer: React.FC<EditUserDrawerProps> = ({ user, isOpen, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<EditUserForm>();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name,
        last_name: user.last_name,
        job_title: user.job_title || '',
        phone_number: user.phone_number || '',
        is_active: user.is_active,
      });
    }
  }, [user, reset]);

  if (!user) return null;

  const onSubmit = async (data: EditUserForm) => {
    setIsLoading(true);
    try {
      await api.put(`/users/${user.id}`, data);
      toast('Success', 'User profile details updated successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('Update Failed', err.response?.data?.error?.message || 'Failed to update user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Consultant: ${user.first_name} ${user.last_name}`}
      description={user.email}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-surface-50 rounded-lg border border-surface-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-surface-500 block">Assigned Role</span>
            <span className="text-sm font-semibold text-surface-900">{user.role?.display_name}</span>
          </div>
          <Badge variant={user.is_active ? 'success' : 'danger'}>
            {user.is_active ? 'Active Account' : 'Deactivated'}
          </Badge>
        </div>

        <Input label="First Name" {...register('first_name', { required: true })} />
        <Input label="Last Name" {...register('last_name', { required: true })} />
        <Input label="Job Title" {...register('job_title')} />
        <Input label="Phone Number" {...register('phone_number')} />

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="is_active_toggle"
            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            {...register('is_active')}
          />
          <label htmlFor="is_active_toggle" className="text-xs font-semibold text-surface-700 cursor-pointer">
            User Account Active
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-surface-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Save User Settings
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
