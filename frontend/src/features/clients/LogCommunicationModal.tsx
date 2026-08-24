import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { MessageSquare, Calendar } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { CommunicationType, Contact } from '@/types/client';
import { api } from '@/lib/axios';
import { formatName } from '@/lib/utils';

interface LogCommunicationModalProps {
  clientId: string;
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LogCommunicationForm {
  type: CommunicationType;
  subject: string;
  notes: string;
  contact_id?: string;
}

export const LogCommunicationModal: React.FC<LogCommunicationModalProps> = ({
  clientId,
  contacts,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<LogCommunicationForm>({
    defaultValues: { type: 'meeting' },
  });
  const { toast } = useToast();

  const onSubmit = async (data: LogCommunicationForm) => {
    setIsLoading(true);
    try {
      await api.post('/communications', { ...data, client_id: clientId });
      toast('Success', 'Client interaction logged', 'success');
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('Failed', err.response?.data?.error?.message || 'Failed to log interaction', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Client Interaction Touchpoint"
      description="Record meeting minutes, phone call summaries, or email updates."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
              Interaction Channel
            </label>
            <select
              className="w-full h-9 bg-white border border-surface-200 rounded-lg px-3 text-sm text-surface-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
              {...register('type')}
            >
              <option value="meeting">Executive Meeting</option>
              <option value="call">Phone Call</option>
              <option value="email">Email Thread</option>
              <option value="note">Internal Strategy Note</option>
            </select>
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
              Attending Stakeholder
            </label>
            <select
              className="w-full h-9 bg-white border border-surface-200 rounded-lg px-3 text-sm text-surface-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
              {...register('contact_id')}
            >
              <option value="">Select stakeholder...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatName(c.first_name, c.last_name)} ({c.job_title || 'Contact'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Subject / Topic Header"
          placeholder="e.g. Q3 Cloud Transformation Architecture Review"
          leftIcon={<MessageSquare className="w-4 h-4" />}
          error={errors.subject?.message}
          {...register('subject', { required: 'Subject header is required' })}
        />

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
            Meeting Notes & Key Action Items
          </label>
          <textarea
            rows={4}
            placeholder="Summarize key decision points, client feedback, and follow-up deliverables..."
            className="w-full bg-white border border-surface-200 rounded-lg p-3 text-sm text-surface-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
            {...register('notes', { required: 'Notes content is required' })}
          />
          {errors.notes && <span className="text-xs font-medium text-red-600">{errors.notes.message}</span>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isLoading}>
            Save Log Entry
          </Button>
        </div>
      </form>
    </Modal>
  );
};
