import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';
import { cn, formatName } from '@/lib/utils';
import { api } from '@/lib/axios';

export interface ClientRM {
  id: string;
  client_id: string;
  user_id: string;
  role_label?: string | null;
  user?: { id: string; first_name: string; last_name: string; email: string };
}

export interface ClientRMSelectProps {
  clientId: string | null;
  selectedUserId: string | null;
  onChange: (userId: string | null) => void;
  className?: string;
  disabled?: boolean;
}

export const ClientRMSelect: React.FC<ClientRMSelectProps> = ({
  clientId,
  selectedUserId,
  onChange,
  className,
  disabled = false,
}) => {
  const [rms, setRms] = useState<ClientRM[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRMs = useCallback(async () => {
    if (!clientId) {
      setRms([]);
      onChange(null);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get(`/clients/${clientId}/rms`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRms(res.data.data);
        if (res.data.data.length === 1) {
          onChange(res.data.data[0].user_id);
        }
      } else {
        setRms([]);
      }
    } catch {
      setRms([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchRMs();
  }, [fetchRMs]);

  if (!clientId) return null;

  return (
    <div className={cn('w-full', className)}>
      <label className="block text-xs font-bold text-[#27332B] mb-1.5">Assign to RM</label>
      {isLoading ? (
        <div className="flex items-center gap-2 h-[38px] bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 text-xs text-[#6B7280]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading RMs...
        </div>
      ) : rms.length === 0 ? (
        <div className="flex items-center gap-2 h-[38px] bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 text-xs text-[#6B7280]">
          <UserCheck className="w-3.5 h-3.5" />
          No RMs linked to this client
        </div>
      ) : (
        <select
          value={selectedUserId || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
        >
          <option value="">Select an RM...</option>
          {rms.map((rm) => (
            <option key={rm.user_id} value={rm.user_id}>
              {formatName(rm.user?.first_name, rm.user?.last_name)}{rm.role_label ? ` (${rm.role_label})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
