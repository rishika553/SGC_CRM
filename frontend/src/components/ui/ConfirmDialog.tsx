import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isLoading = false,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" hideHeader>
      <div className="text-center">
        <div className="mx-auto w-11 h-11 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
        </div>

        <h3 className="text-base font-bold text-surface-900 tracking-tight mt-3">{title}</h3>
        <div className="text-sm text-surface-500 mt-1.5 leading-relaxed">{message}</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="danger"
          size="md"
          isLoading={isLoading}
          onClick={onConfirm}
          leftIcon={!isLoading ? <AlertTriangle className="w-4 h-4" /> : undefined}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};