import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'right' | 'left';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  position = 'right',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-surface-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className={cn('fixed inset-y-0 flex max-w-full z-10', position === 'right' ? 'right-0' : 'left-0')}>
        <div className="w-screen max-w-full sm:max-w-md bg-white border-l border-surface-200 shadow-modal flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-surface-100">
            <div>
              {title && <h3 className="text-sm sm:text-base font-semibold text-surface-900">{title}</h3>}
              {description && <p className="text-[11px] sm:text-xs text-surface-500 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 sm:py-3.5 bg-surface-50 border-t border-surface-100">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
