import React from 'react';
import { FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FolderOpen className="w-8 h-8 text-surface-400" />,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center bg-white border border-surface-200 rounded-crm shadow-card', className)}>
      <div className="p-3 bg-surface-50 rounded-full border border-surface-100 mb-3">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-surface-900 tracking-tight">{title}</h4>
      {description && <p className="text-xs text-surface-500 max-w-sm mt-1 mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
