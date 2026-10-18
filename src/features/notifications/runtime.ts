import { firebaseApp, pushConfigured } from '../../lib/firebase-config';
import { unsubscribeBrowserPush } from '../../lib/push-cleanup';
import {
  cacheIsCurrent,
  readPushBinding,
  writePushBinding,
  type CacheSession,
  type PushBinding,
} from '../offline/store';
let tokenRuntime:
  | { sdk: typeof import('firebase/messaging'); messaging: import('firebase/messaging').Messaging }
  | undefined;
export type PushCapability = 'ready' | 'unconfigured' | 'unsupported' | 'install' | 'insecure';
export async function pushCapability(): Promise<PushCapability> {
  if (!window.isSecureContext) return 'insecure';
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (
    ios &&
    !matchMedia('(display-mode: standalone)').matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
    return 'install';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))
    return 'unsupported';
  if (!pushConfigured) return 'unconfigured';
  return (await (await import('firebase/messaging')).isSupported()) ? 'ready' : 'unsupported';
}
type Call = <T>(path: string, options?: RequestInit) => Promise<T>;
export async function enablePush(
  permission: Promise<NotificationPermission>,
  cache: CacheSession,
  request: Call,
) {
  if ((await permission) !== 'granted') throw new Error('permission_denied');
  const sdk = await import('firebase/messaging');
  const registration = await navigator.serviceWorker.ready;
  if (!(await cacheIsCurrent(cache))) throw new Error('session_changed');
  const prior = await readPushBinding(cache),
    binding: PushBinding = {
      deviceId: prior?.deviceId ?? crypto.randomUUID(),
      binding: prior?.active ? prior.binding : crypto.randomUUID(),
      active: true,
      expiresAt: Date.now() + 30 * 86400000,
    };
  const messaging = sdk.getMessaging(await firebaseApp());
  const token = await sdk.getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  tokenRuntime = { sdk, messaging };
  if (!token || !(await cacheIsCurrent(cache))) throw new Error('session_changed');
  await request('/api/push-subscriptions', {
    method: 'PUT',
    body: JSON.stringify({ deviceId: binding.deviceId, binding: binding.binding, token }),
  });
  if (!(await cacheIsCurrent(cache))) throw new Error('session_changed');
  await writePushBinding(cache, binding);
  return binding;
}
export async function disablePush(cache: CacheSession, request: Call) {
  const binding = await readPushBinding(cache);
  if (!binding) return;
  await writePushBinding(cache, { ...binding, active: false });
  try {
    await unsubscribeBrowserPush();
    // A fresh SDK instance would otherwise register a second default SW.
    if (tokenRuntime) {
      const active = tokenRuntime;
      await active.sdk.deleteToken(active.messaging);
      if (tokenRuntime === active) tokenRuntime = undefined;
    }
  } finally {
    // Server cancellation still runs if a browser API fails or does not respond.
    if (binding) {
      await request('/api/push-subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({ deviceId: binding.deviceId }),
        signal: AbortSignal.timeout(5000),
      });
      await writePushBinding(cache, null);
    }
  }
}
export async function refreshPush(cache: CacheSession, request: Call) {
  const binding = await readPushBinding(cache);
  if (!binding?.active) return;
  if (Notification.permission !== 'granted') {
    await disablePush(cache, request);
    return;
  }
  await enablePush(Promise.resolve('granted'), cache, request);
}
export async function foreground(cache: CacheSession, onNotice: (id: string) => void) {
  const binding = await readPushBinding(cache);
  if (!binding?.active || !pushConfigured) return () => {};
  const sdk = await import('firebase/messaging');
  return sdk.onMessage(sdk.getMessaging(await firebaseApp()), (payload) => {
    void (async () => {
      const now = await readPushBinding(cache).catch(() => null);
      const d = payload.data;
      if (
        now?.active &&
        d?.type === 'archive-notice' &&
        d.binding === now.binding &&
        /^[A-Za-z0-9_-]{1,128}$/.test(d.noticeId ?? '')
      )
        onNotice(d.noticeId!);
    })();
  });
}
