import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Lock, User, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { SplitLoginLayout } from '@/components/auth/SplitLoginLayout';
import { api } from '@/lib/axios';

interface ResetPasswordFormData {
  username: string;
  new_password: string;
  confirm_password: string;
}

export const ResetPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isClientPortal = location.pathname.startsWith('/client');
  const brandBadge = isClientPortal ? 'Client Portal' : 'Super Admin Portal';
  const loginPath = isClientPortal ? '/client/login' : '/superadmin/login';
  const altLoginPath = isClientPortal ? '/superadmin/login' : '/client/login';
  const altLabel = isClientPortal ? 'Super Admin' : 'Client Stakeholder';
  const altHint = isClientPortal ? 'Go to Super Admin Portal Login' : 'Go to Client Portal Login';
  const usernamePlaceholder = isClientPortal ? 'e.g. client@example.com' : 'e.g. admin@sgccrm.com';

  const newPassword = watch('new_password');

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/admin-reset-password', {
        username: data.username,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      if (res.data?.success) {
        setIsSuccess(true);
        toast('Password Reset', 'Your password has been reset successfully.', 'success');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to reset password';
      toast('Reset Failed', errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const portalHint = (
    <p className="text-xs text-[#6B7280]">
      Are you a {altLabel.toLowerCase()}?{' '}
      <Link to={altLoginPath} className="text-[#5E8C61] font-bold hover:underline">
        {altHint}
      </Link>
    </p>
  );

  if (isSuccess) {
    return (
      <SplitLoginLayout brandBadge={brandBadge} portalHint={portalHint}>
        <div className="text-center py-8 space-y-4">
          <CheckCircle className="w-14 h-14 text-[#5E8C61] mx-auto" />
          <h2 className="text-lg font-bold text-[#27332B]">Password Reset Successful</h2>
          <p className="text-xs text-[#6B7280]">
            Your password has been updated. You can now sign in with your new credentials.
          </p>
          <Button
            type="button"
            variant="primary"
            className="w-full mt-3 py-2.5 bg-[#2F4F3A] hover:bg-[#243E2E] text-white shadow-xs transition-all font-bold"
            onClick={() => navigate(loginPath)}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Back to Login
          </Button>
        </div>
      </SplitLoginLayout>
    );
  }

  return (
    <SplitLoginLayout brandBadge={brandBadge} portalHint={portalHint}>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#27332B]">Reset Password</h2>
        <p className="text-xs text-[#6B7280] mt-1">
          Enter your username/email and a new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Username (Email)"
          type="text"
          placeholder={usernamePlaceholder}
          leftIcon={<User className="w-4 h-4 text-slate-400" />}
          error={errors.username?.message}
          {...register('username', { required: 'Username is required' })}
        />

        <Input
          label="New Password"
          type={showNewPassword ? 'text' : 'password'}
          placeholder="Min 8 characters"
          leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
          rightIcon={showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          onRightIconClick={() => setShowNewPassword((v) => !v)}
          error={errors.new_password?.message}
          {...register('new_password', {
            required: 'New password is required',
            minLength: { value: 8, message: 'Password must be at least 8 characters' },
          })}
        />

        <Input
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Re-enter your new password"
          leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
          rightIcon={showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          onRightIconClick={() => setShowConfirmPassword((v) => !v)}
          error={errors.confirm_password?.message}
          {...register('confirm_password', {
            required: 'Please confirm your password',
            validate: (value) => value === newPassword || 'Passwords do not match',
          })}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-3 py-2.5 bg-[#2F4F3A] hover:bg-[#243E2E] text-white shadow-xs transition-all font-bold"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Reset Password
        </Button>

        <div className="text-center pt-2">
          <Link to={loginPath} className="text-xs font-semibold text-[#5E8C61] hover:underline">
            Back to Login
          </Link>
        </div>
      </form>
    </SplitLoginLayout>
  );
};
