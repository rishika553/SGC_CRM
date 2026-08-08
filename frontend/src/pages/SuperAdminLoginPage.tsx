import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, Crown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { ForgotPasswordModal } from '@/features/auth/ForgotPasswordModal';

interface LoginFormData {
  email: string;
  password: string;
}

export const SuperAdminLoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
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
    <div className="relative min-h-screen bg-[#F7F9F6] flex items-center justify-center p-4 overflow-hidden">
      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2F4F3A] flex items-center justify-center text-white font-bold text-2xl shadow-md mb-3">
            <Crown className="w-7 h-7 text-amber-300" />
          </div>
          <h1 className="text-2xl font-bold text-[#27332B] tracking-tight">SGC CRM</h1>
          <p className="text-xs font-extrabold text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full mt-1.5 uppercase tracking-wider border border-amber-300/50">
            Super Admin Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_6px_20px_rgba(47,79,58,.05)] border border-[#E3E8E3]">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#27332B]">Super Admin Sign In</h2>
            <p className="text-xs text-[#6B7280] mt-1">Enter your corporate administrator credentials</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address or Username"
              type="text"
              placeholder="e.g. admin@sgccrm.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              error={errors.email?.message}
              {...register('email', { required: 'Email address or username is required' })}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              error={errors.password?.message}
              {...register('password', { required: 'Password is required' })}
            />

            <div className="flex items-center justify-between text-xs pt-1">
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
              Sign In to Super Admin
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E3E8E3] text-center">
            <p className="text-xs text-[#6B7280]">
              Are you a client stakeholder?{' '}
              <Link to="/client/login" className="text-[#5E8C61] font-bold hover:underline">
                Go to Client Portal Login
              </Link>
            </p>
          </div>
        </div>

        {/* Security Footer */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-surface-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>256-bit SSL Encrypted & Enterprise Protected</span>
        </div>
      </div>

      <ForgotPasswordModal isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)} />
    </div>
  );
};
