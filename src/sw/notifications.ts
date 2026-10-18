/// <reference lib="webworker" />
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, onBackgroundMessage, isSupported } from 'firebase/messaging/sw';
import { firebaseConfig, pushConfigured } from '../lib/firebase-config';
interface Binding {
  binding: string;
  active: boolean;
  expiresAt: number;
}
export async function activePushBinding(): Promise<Binding | null> {
  if (!(await indexedDB.databases()).some((d) => d.name === 'tankyu-offline-v1')) return null;
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('tankyu-offline-v1', 1);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('control')) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction('control', 'readonly'),
        q = tx.objectStore('control').get('owner');
      let value: Binding | null = null;
      q.onsuccess = () => {
        const c = q.result,
          p = c?.push;
        if (c && !c.blocked && p?.active && p.expiresAt > Date.now()) value = p;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
export async function showArchivePush(
  scope: ServiceWorkerGlobalScope,
  data: Record<string, string> | undefined,
) {
  if (data?.type !== 'archive-notice' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.noticeId ?? ''))
    return;
  const current = await activePushBinding().catch(() => null);
  if (!current || data.binding !== current.binding) return;
  await scope.registration.showNotification('探究アーカイブ', {
    body: '新しいお知らせがあります。アプリで確認してください。',
    icon: '/icons/app-icon.png',
    tag: 'archive-' + data.noticeId,
    data: { noticeId: data.noticeId, binding: current.binding },
  });
}
export function installNotifications(scope: ServiceWorkerGlobalScope) {
  // Register before the SDK click handler; only our own tag and fixed same-origin URL are accepted.
  scope.addEventListener('notificationclick', (event) => {
    if (!event.notification.tag.startsWith('archive-')) return;
    event.stopImmediatePropagation();
    event.notification.close();
    event.waitUntil(
      (async () => {
        const d = event.notification.data as { noticeId?: string; binding?: string };
        const current = await activePushBinding().catch(() => null);
        if (
          !current ||
          d.binding !== current.binding ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(d.noticeId ?? '')
        )
          return;
        const url = new URL(
          '/notifications?open=' + encodeURIComponent(d.noticeId!),
          scope.location.origin,
        ).href;
        const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const client = windows.find((c) => new URL(c.url).origin === scope.location.origin) as
          WindowClient | undefined;
        if (client) {
          await client.navigate(url);
          await client.focus();
        } else await scope.clients.openWindow(url);
      })(),
    );
  });
  if (pushConfigured)
    void isSupported()
      .then((supported) => {
        if (supported)
          onBackgroundMessage(
            getMessaging(getApps()[0] ?? initializeApp(firebaseConfig)),
            (payload) => showArchivePush(scope, payload.data),
          );
      })
      .catch(() => {});
}
