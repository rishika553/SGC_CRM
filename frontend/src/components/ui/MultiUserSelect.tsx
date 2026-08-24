import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown, Search, Users } from 'lucide-react';
import { cn, formatName, getInitials } from '@/lib/utils';
import { api } from '@/lib/axios';
import { User } from '@/types';

export interface MultiUserSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  excludeClientRoles?: boolean;
}

export const MultiUserSelect: React.FC<MultiUserSelectProps> = ({
  selectedIds,
  onChange,
  placeholder = 'Select team members...',
  className,
  disabled = false,
  excludeClientRoles = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const CLIENT_ROLES = new Set(['client', 'client_viewer']);

  const fetchUsers = useCallback(async () => {
    if (users.length > 0) return;
    setIsLoading(true);
    try {
      const res = await api.get('/users', { params: { page: 1, page_size: 100, is_active: true } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        const filtered = excludeClientRoles
          ? res.data.data.filter((u: User) => !CLIENT_ROLES.has(u.role?.name || ''))
          : res.data.data;
        setUsers(filtered);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [users.length, excludeClientRoles]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, fetchUsers]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedUsers([]);
      return;
    }
    if (users.length > 0) {
      setSelectedUsers(users.filter((u) => selectedIds.includes(u.id)));
    }
  }, [selectedIds, users]);

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fullName = formatName(u.first_name, u.last_name).toLowerCase();
    return fullName.includes(q) || u.email.toLowerCase().includes(q);
  });

  const toggleUser = (user: User) => {
    const isSelected = selectedIds.includes(user.id);
    const next = isSelected
      ? selectedIds.filter((id) => id !== user.id)
      : [...selectedIds, user.id];
    onChange(next);
  };

  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <label className="block text-xs font-bold text-[#27332B] mb-1.5">Assigned RMs</label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full min-h-[38px] bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-medium text-left',
          'flex items-center flex-wrap gap-1.5',
          'focus:outline-none focus:border-[#5E8C61]',
          isOpen && 'border-[#5E8C61]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {selectedUsers.length === 0 && (
          <span className="text-[#6B7280]">{placeholder}</span>
        )}
        {selectedUsers.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 bg-[#2F4F3A] text-white rounded-full pl-2 pr-1 py-0.5 text-[10px] font-semibold"
          >
            {getInitials(u.first_name, u.last_name)}
            <button
              type="button"
              onClick={(e) => removeUser(u.id, e)}
              className="p-0.5 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-[#6B7280] ml-auto shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E3E8E3] rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#E3E8E3]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 bg-[#F7F9F6] border border-[#E3E8E3] rounded-lg pl-8 pr-3 text-xs focus:outline-none focus:border-[#5E8C61]"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-[#6B7280]">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#6B7280]">
                <Users className="w-3.5 h-3.5" />
                No users found
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      isSelected ? 'bg-[#EEF5EF]' : 'hover:bg-[#F7F9F6]'
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                        isSelected ? 'bg-[#2F4F3A] text-white' : 'bg-[#E3E8E3] text-[#6B7280]'
                      )}
                    >
                      {getInitials(user.first_name, user.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#27332B] truncate">
                        {formatName(user.first_name, user.last_name)}
                      </div>
                      <div className="text-[10px] text-[#6B7280] truncate">{user.email}</div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-[#2F4F3A] flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
