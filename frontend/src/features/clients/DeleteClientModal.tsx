import React, { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { clientQueryKeys } from './clientQueries';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete client account?"
      message={
        <>
          The <span className="font-semibold">"{client.name}"</span> client account will be removed.
        </>
      }
      isLoading={isLoading}
      onConfirm={handleDelete}
    />
  );
};