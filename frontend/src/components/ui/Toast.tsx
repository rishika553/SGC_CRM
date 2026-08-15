import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (title: string, description?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = useCallback((title: string, description?: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setMessages((prev) => [...prev, { id, title, description, type }]);

    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm z-50 flex flex-col gap-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex items-start gap-3 p-3.5 bg-white border rounded-crm shadow-modal transition-all animate-in slide-in-from-bottom-2',
              m.type === 'success' && 'border-emerald-200 text-emerald-950',
              m.type === 'error' && 'border-rose-200 text-rose-950',
              m.type === 'info' && 'border-surface-200 text-surface-900'
            )}
          >
            {m.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {m.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {m.type === 'info' && <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />}
            
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-semibold">{m.title}</h5>
              {m.description && <p className="text-[11px] text-surface-500 mt-0.5">{m.description}</p>}
            </div>

            <button onClick={() => removeToast(m.id)} className="text-surface-400 hover:text-surface-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
