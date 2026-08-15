import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { clientQueryKeys } from './clientQueries';

interface DeleteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: { id: string; name: string } | null;
}

export const DeleteClientModal: React.FC<DeleteClientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  client,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  if (!client) return null;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await api.delete(`/clients/${client.id}`);
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.directory });
      toast('Client Account Deleted', `Client company account "${client.name}" has been deleted.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast('Delete Failed', err.response?.data?.error?.message || err.response?.data?.message || 'Failed to delete client account', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Client Account"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-red-900">Are you sure you want to delete this client profile?</p>
            <p className="text-red-700">
              You are about to delete <strong className="font-bold">{client.name}</strong>. The profile will be archived/soft-deleted from the client directory.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="button"
            leftIcon={<Trash2 className="w-4 h-4" />}
            isLoading={isLoading}
            onClick={handleDelete}
          >
            Confirm Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};
