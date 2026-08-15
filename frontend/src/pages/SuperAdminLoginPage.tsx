import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { ForgotPasswordModal } from '@/features/auth/ForgotPasswordModal';
import { SplitLoginLayout } from '@/components/auth/SplitLoginLayout';

interface LoginFormData {
  email: string;
  password: string;
}

export const SuperAdminLoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password, 'superadmin');
      toast('Welcome back', 'Super Admin authentication successful', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      const errorMsg = err.message || err.response?.data?.error?.message || err.response?.data?.detail || 'Invalid Super Admin credentials';
      toast('Access Denied', errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SplitLoginLayout
        brandBadge="Super Admin Portal"
        portalHint={
          <p className="text-xs text-[#6B7280]">
            Are you a client stakeholder?{' '}
            <Link to="/client/login" className="text-[#5E8C61] font-bold hover:underline">
              Go to Client Portal Login
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email or Username"
            type="text"
            placeholder="e.g. admin@sgccrm.com"
            leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
            error={errors.email?.message}
            {...register('email', { required: 'Email address or username is required' })}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            rightIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            onRightIconClick={() => setShowPassword((v) => !v)}
            error={errors.password?.message}
            {...register('password', { required: 'Password is required' })}
          />

          <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[#6B7280] hover:text-[#27332B] transition-colors">
              <input type="checkbox" className="w-4 h-4 rounded border-[#E3E8E3] text-[#5E8C61] focus:ring-[#5E8C61]" />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setIsForgotOpen(true)}
              className="text-[#5E8C61] font-semibold hover:text-[#4F7A52] transition-colors focus:outline-none"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-3 py-2.5 bg-[#2F4F3A] hover:bg-[#243E2E] text-white shadow-xs transition-all font-bold"
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>
      </SplitLoginLayout>

      <ForgotPasswordModal isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)} />
    </>
  );
};
