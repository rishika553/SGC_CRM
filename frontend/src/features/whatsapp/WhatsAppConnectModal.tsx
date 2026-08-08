import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Wifi, WifiOff, RefreshCw, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/axios';

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppConnectModal: React.FC<WhatsAppConnectModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectedUser, setConnectedUser] = useState<{ wid?: string; pushname?: string } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await api.get('/whatsapp/status');
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setStatus(d.status || 'disconnected');
        setConnectedUser(d.user || null);

        if (d.status === 'qr_ready' || d.status === 'connecting') {
          const qrRes = await api.get('/whatsapp/qr');
          if (qrRes.data.success && qrRes.data.data?.qr) {
            setQrCode(qrRes.data.data.qr);
          }
        } else {
          setQrCode(null);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'WhatsApp Node.js service offline or unreachable (port 3001)';
      setErrorMessage(msg);
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, fetchStatus]);

  const handleConnect = async () => {
    setIsActionLoading(true);
    try {
      setErrorMessage(null);
      setQrCode(null);
      const res = await api.post('/whatsapp/connect');
      if (res.data.success) {
        toast('Initiating WhatsApp', 'Generating QR code...', 'info');
        setStatus('connecting');

        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            const qrRes = await api.get('/whatsapp/qr');
            const qrData = qrRes.data?.data;
            if (qrData?.qr) {
              setQrCode(qrData.qr);
              setStatus('qr_ready');
              break;
            }
            const statusRes = await api.get('/whatsapp/status');
            const statusData = statusRes.data?.data;
            if (statusData?.status) setStatus(statusData.status);
            if (statusData?.status === 'connected' || statusData?.status === 'disconnected') break;
          } catch {
            // keep polling until attempts exhausted
          }
        }
      }
    } catch (err: any) {
      toast('Connection Error', err.response?.data?.error?.message || 'Failed to start WhatsApp service', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsActionLoading(true);
    try {
      const res = await api.post('/whatsapp/disconnect');
      if (res.data.success) {
        toast('Disconnected', 'WhatsApp Web session terminated.', 'info');
        setStatus('disconnected');
        setQrCode(null);
        setConnectedUser(null);
      }
    } catch (err: any) {
      toast('Disconnect Failed', err.response?.data?.error?.message || 'Failed to disconnect', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="WhatsApp Web Integration (Superadmin Only)"
      description="Connect WhatsApp Web to send and receive communications."
      size="md"
    >
      <div className="space-y-5">
        {/* Status Header Badge */}
        <div className="flex items-center justify-between p-3.5 bg-surface-50 border border-surface-200 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Service Status</div>
              <div className="text-sm font-extrabold text-surface-900 capitalize">
                {status === 'qr_ready' ? 'Scan QR Code' : status}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'connected' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            )}
            {(status === 'connecting' || status === 'qr_ready') && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-700" />
                {status === 'qr_ready' ? 'Waiting for Scan' : 'Initializing'}
              </span>
            )}
            {status === 'disconnected' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                Disconnected
              </span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">WhatsApp Service Offline</p>
              <p className="text-red-700 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Main Content Area: QR Display / Connected Details / Action Prompt */}
        {status === 'connected' ? (
          <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-emerald-950">WhatsApp Connected!</h4>
              <p className="text-xs font-medium text-emerald-800 mt-1">
                Account: <b className="font-bold text-emerald-900">{connectedUser?.pushname || 'WhatsApp Device'}</b>
              </p>
              {connectedUser?.wid && (
                <p className="text-[11px] font-mono text-emerald-700 mt-0.5">{connectedUser.wid}</p>
              )}
            </div>
          </div>
        ) : status === 'qr_ready' && qrCode ? (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white border border-surface-200 rounded-2xl shadow-xs inline-block mx-auto">
              <img src={qrCode} alt="WhatsApp Web QR Code" className="w-56 h-56 mx-auto rounded-lg" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-surface-900">Scan this QR Code with WhatsApp</p>
              <p className="text-[11px] text-surface-500 max-w-xs mx-auto">
                Open WhatsApp on phone → Settings → Linked Devices → Link a Device
              </p>
            </div>
          </div>
        ) : status === 'connecting' ? (
          <div className="py-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
            <p className="text-xs font-semibold text-surface-700">Starting Chromium & Generating QR Code...</p>
          </div>
        ) : (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-surface-600">
              No active WhatsApp session found. Click **Connect WhatsApp** to initialize WhatsApp Web.
            </p>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {status === 'connected' ? (
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              leftIcon={<LogOut className="w-4 h-4" />}
              isLoading={isActionLoading}
              onClick={handleDisconnect}
            >
              Disconnect WhatsApp
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Wifi className="w-4 h-4" />}
              isLoading={isActionLoading || status === 'connecting'}
              onClick={handleConnect}
            >
              Connect WhatsApp
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
