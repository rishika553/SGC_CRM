import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-48 bg-white border border-surface-200 rounded-lg shadow-dropdown py-1 transition-all',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors',
                item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900',
                item.disabled && 'opacity-50 pointer-events-none'
              )}
            >
              {item.icon && <span className="w-4 h-4 text-surface-400">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
