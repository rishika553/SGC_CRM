import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/axios';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ForgotPasswordForm {
  email: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ForgotPasswordForm>();
  const { toast } = useToast();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      setIsSuccess(true);
      toast('Reset Link Sent', 'Check your inbox for password recovery instructions.', 'success');
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to request reset', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setIsSuccess(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reset Your Password"
      description="Enter your corporate email address to receive a secure recovery link."
    >
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-surface-900">Reset Dispatched</h4>
          <p className="text-xs text-surface-500 max-w-xs">
            We have sent a 15-minute single-use password recovery link to your inbox.
          </p>
          <Button variant="primary" size="sm" onClick={handleClose} className="mt-2">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Corporate Email"
            type="email"
            placeholder="consultant@company.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email', { required: 'Email address is required' })}
          />

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-100 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleClose} type="button" className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isLoading} className="flex-1 sm:flex-none">
              Send Reset Link
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
