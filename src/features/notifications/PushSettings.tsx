import { useEffect, useState } from 'react';
import { useAuth } from '../auth/context';
import { readPushBinding, writePushBinding, type PushBinding } from '../offline/store';
import { pushCapability, enablePush, disablePush, type PushCapability } from './runtime';
import type { PushStatusDto } from '../../contracts/notifications.generated';
export function PushSettings() {
  const { request, cacheSession, offline } = useAuth();
  const [cap, setCap] = useState<PushCapability | null>(null),
    [binding, setBinding] = useState<PushBinding | null>(null),
    [permission, setPermission] = useState<NotificationPermission>('default'),
    [server, setServer] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const c = await pushCapability();
        if (alive) {
          setCap(c);
          setPermission('Notification' in window ? Notification.permission : 'default');
        }
        if (!cacheSession || offline) return;
        const b = await readPushBinding(cacheSession);
        const status = await request<PushStatusDto>(
          '/api/push-subscriptions?deviceId=' +
            encodeURIComponent(b?.deviceId ?? crypto.randomUUID()),
        );
        if (alive) {
          setBinding(b ? { ...b, active: b.active && status.enabled && status.registered } : null);
          setServer(status.enabled);
          if (b?.active && (!status.enabled || !status.registered))
            void writePushBinding(cacheSession, { ...b, active: false }).catch(() => {});
        }
      } catch {
        if (alive)
          setMessage('通知設定を確認できませんでした。通信に接続して画面を読み直してください。');
      }
    }
    void check();
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      window.removeEventListener('focus', check);
    };
  }, [cacheSession, request, offline]);
  // Auth request function changes during renders: depend on stable identity below in parent.
  function enable() {
    if (!cacheSession || busy) return;
    const permissionRequest = Notification.requestPermission();
    setBusy(true);
    setMessage('');
    void enablePush(permissionRequest, cacheSession, request)
      .then(setBinding)
      .catch(() =>
        setMessage('通知を登録できませんでした。ブラウザの許可と通信を確認してください。'),
      )
      .finally(() => {
        setPermission(Notification.permission);
        setBusy(false);
      });
  }
  async function stop() {
    if (!cacheSession) return;
    setBusy(true);
    setMessage('');
    try {
      await disablePush(cacheSession, request);
      setBinding(null);
      setMessage('この端末への通知を停止しました。');
    } catch {
      setBinding(await readPushBinding(cacheSession).catch(() => null));
      setMessage(
        '通知の解除を完全には確認できませんでした。画面を読み直すか、もう一度解除をお試しください。',
      );
    } finally {
      setBusy(false);
    }
  }
  const guide: Record<PushCapability, string> = {
    ready: '通知はこの端末だけに届きます。いつでも停止できます。',
    unconfigured: 'Push通知の接続設定を準備中です。お知らせ一覧は利用できます。',
    unsupported: 'このブラウザはPush通知に対応していません。お知らせ一覧をご利用ください。',
    install:
      'iPhone・iPadでは、共有メニューからホーム画面に追加し、そのアイコンから開いてください（iOS・iPadOS 16.4以降）。',
    insecure: 'Push通知にはHTTPSの接続が必要です。',
  };
  return (
    <section className="notification-settings" aria-label="端末への通知">
      <h2>この端末で通知を受け取る</h2>
      <p>{cap ? guide[cap] : '通知への対応を確認しています…'}</p>
      {permission === 'denied' && (
        <p>ブラウザ設定で通知が拒否されています。設定から許可すると再登録できます。</p>
      )}
      {cap === 'ready' && !server && (
        <p>サービス側の配信が停止中、または端末登録が失効しています。再確認してください。</p>
      )}
      <p>{binding?.active ? '端末登録：有効' : '端末登録：なし'}</p>
      <button
        className="button primary"
        disabled={
          busy ||
          offline ||
          cap !== 'ready' ||
          permission === 'denied' ||
          !server ||
          !!binding?.active
        }
        onClick={enable}
      >
        通知を受け取る
      </button>
      {binding && (
        <button className="button secondary" disabled={busy || offline} onClick={() => void stop()}>
          {binding.active ? 'この端末の通知を停止' : '登録解除を再試行'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
