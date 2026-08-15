import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { User as UserIcon, Lock, Shield, Phone, Briefcase, Mail, CheckCircle, LogOut } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/axios';

interface ProfileFormData {
  first_name: string;
  last_name: string;
  phone_number?: string;
  job_title?: string;
}

interface SecurityFormData {
  current_password: string;
  new_password: string;
}

export const UserProfilePage: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const roleNameStr = String(user?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone_number: user?.phone_number || '',
      job_title: user?.job_title || '',
    },
  });

  const securityForm = useForm<SecurityFormData>();

  const onUpdateProfile = async (data: ProfileFormData) => {
    setIsUpdatingProfile(true);
    try {
      await api.put('/users/me', data);
      await refreshProfile();
      toast('Success', 'Profile details updated successfully', 'success');
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to update profile', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onChangePassword = async (data: SecurityFormData) => {
    if (isClientRole) {
      toast('Access Denied', 'Client accounts cannot change passwords. Please contact Super Admin.', 'error');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await api.put('/users/me/change-password', data);
      securityForm.reset();
      toast('Success', 'Security password changed successfully', 'success');
    } catch (err: any) {
      toast('Password Change Failed', err.response?.data?.error?.message || 'Invalid current password', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <MainLayout user={user || undefined}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Banner */}
        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 font-bold text-xl flex items-center justify-center border-2 border-brand-200 shadow-subtle shrink-0">
                {user ? `${user.first_name[0]}${user.last_name[0]}` : 'U'}
              </div>
              <div>
                <h1 className="text-lg font-bold text-surface-900 tracking-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'User Profile'}
                </h1>
                <p className="text-xs text-surface-500">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="primary">{user?.role?.display_name || user?.role?.name || 'Consultant'}</Badge>
                  <Badge variant="success">Account Active</Badge>
                </div>
              </div>
            </div>

            {/* Tabs toggle */}
            {!isClientRole && (
              <div className="flex flex-wrap bg-surface-100 p-1 rounded-lg border border-surface-200">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-white text-surface-900 shadow-subtle'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  Personal Details
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'security'
                      ? 'bg-white text-surface-900 shadow-subtle'
                      : 'text-surface-600 hover:text-surface-900'
                  }`}
                >
                  Security & Auth
                </button>
              </div>
            )}
          </div>
        </Card>

        {activeTab === 'profile' ? (
          <Card padding="md">
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>Update your contact information and firm job title</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    error={profileForm.formState.errors.first_name?.message}
                    {...profileForm.register('first_name', { required: 'First name is required' })}
                  />
                  <Input
                    label="Last Name"
                    error={profileForm.formState.errors.last_name?.message}
                    {...profileForm.register('last_name', { required: 'Last name is required' })}
                  />
                  <Input
                    label="Job Title"
                    leftIcon={<Briefcase className="w-4 h-4" />}
                    {...profileForm.register('job_title')}
                  />
                  <Input
                    label="Phone Number"
                    leftIcon={<Phone className="w-4 h-4" />}
                    {...profileForm.register('phone_number')}
                  />
                </div>

                {/* Bottom Actions Row: Sign Out next to Save Changes (Increased size) */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 border-t border-surface-100">
                  <Button
                    type="button"
                    variant="danger"
                    size="lg"
                    onClick={logout}
                    leftIcon={<LogOut className="w-5 h-5" />}
                    className="w-full sm:w-auto px-6 py-3 text-base shadow-sm font-bold"
                  >
                    Sign Out
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isUpdatingProfile}
                    className="w-full sm:w-auto px-8 py-3 text-base shadow-sm font-bold bg-[#2F4F3A] hover:bg-[#243E2E]"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card padding="md">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Update your password and view account security status</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={securityForm.handleSubmit(onChangePassword)} className="space-y-6">
                <div className="max-w-md space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={securityForm.formState.errors.current_password?.message}
                    {...securityForm.register('current_password', { required: 'Current password is required' })}
                  />
                  <Input
                    label="New Password"
                    type="password"
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={securityForm.formState.errors.new_password?.message}
                    {...securityForm.register('new_password', {
                      required: 'New password is required',
                      minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    })}
                  />
                </div>

                {/* Bottom Actions Row: Sign Out next to Update Password */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 border-t border-surface-100">
                  <Button
                    type="button"
                    variant="danger"
                    size="lg"
                    onClick={logout}
                    leftIcon={<LogOut className="w-5 h-5" />}
                    className="w-full sm:w-auto px-6 py-3 text-base shadow-sm font-bold"
                  >
                    Sign Out
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isUpdatingPassword}
                    className="w-full sm:w-auto px-8 py-3 text-base shadow-sm font-bold bg-[#2F4F3A] hover:bg-[#243E2E]"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};
