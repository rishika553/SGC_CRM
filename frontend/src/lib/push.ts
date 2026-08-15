import { api } from './axios';

interface PushKeys {
  p256dh: string;
  auth: string;
}

interface PushSubscriptionPayload {
  endpoint: string;
  keys: PushKeys;
  user_agent?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushConfig(): Promise<{ enabled: boolean; vapid_public_key: string }> {
  const res = await api.get('/notifications/config');
  return res.data.data;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register('/sw.js');
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const config = await getPushConfig();
  if (!config.enabled || !config.vapid_public_key) return false;

  if (Notification.permission === 'denied') return false;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  const reg = await registerServiceWorker();
  if (!reg) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: PushKeys };
  if (!json.endpoint || !json.keys) return false;

  const payload: PushSubscriptionPayload = {
    endpoint: json.endpoint,
    keys: json.keys,
    user_agent: navigator.userAgent,
  };

  await api.post('/notifications/subscribe', payload);
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);

  try {
    await api.post('/notifications/unsubscribe', { endpoint });
  } catch {
    // The token may already be gone during logout; the browser unsubscribe is enough.
  }
}
