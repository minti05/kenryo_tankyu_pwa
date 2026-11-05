import { LoadingSkeleton } from '../../components/Loading';
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import { noticeIsRead } from './local-state';
import { useLocalNoticeState, useNoticeInbox } from './queries';
const NotificationsPanel = lazy(() =>
  import('./NotificationsPage').then((m) => ({ default: m.NotificationsPanel })),
);
import './notifications.css';
export function NotificationMenu() {
  const { session, offline } = useAuth(),
    client = useQueryClient();
  useNoticeInbox();
  const local = useLocalNoticeState();
  const hasUnread = local.data?.items.some((n) => !noticeIsRead(local.data, n));
  const [params, setParams] = useSearchParams(),
    [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    id = useId();
  const notice = params.get('notice');
  const initialNotice = notice && /^[A-Za-z0-9_-]{1,128}$/.test(notice) ? notice : null;
  const requested = !!initialNotice || params.get('notices') === '1',
    visible = open || requested;
  useEffect(() => {
    if (visible && !offline)
      void client.invalidateQueries(
        { queryKey: ['notifications', 'inbox', session?.uid] },
        { cancelRefetch: false },
      );
  }, [visible, offline, session?.uid, client]);
  const close = useCallback(
    (restoreFocus = false) => {
      setOpen(false);
      if (requested) {
        const next = new URLSearchParams(params);
        next.delete('notice');
        next.delete('notices');
        setParams(next, { replace: true });
      }
      if (restoreFocus) button.current?.focus({ preventScroll: true });
    },
    [requested, params, setParams],
  );
  useEffect(() => {
    if (!visible) return;
    closeButton.current?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close(true);
        event.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', outside);
    };
  }, [visible, close]);
  return (
    <div className="notification-menu" ref={root}>
      <button
        className="icon-button"
        ref={button}
        aria-label="お知らせ"
        aria-haspopup="dialog"
        aria-expanded={visible}
        aria-controls={id}
        onClick={() => (visible ? close() : setOpen(true))}
      >
        <Bell size={23} />
        {session && hasUnread && (
          <span
            className="notification-badge"
            role="status"
            aria-label="未読のお知らせがあります"
          />
        )}
      </button>
      {visible && (
        <div className="notification-popover" role="dialog" aria-label="お知らせ" id={id}>
          <div className="notification-popover-heading">
            <h2>お知らせ</h2>
            <button
              className="icon-button"
              aria-label="お知らせを閉じる"
              ref={closeButton}
              onClick={() => close(true)}
            >
              <X size={21} />
            </button>
          </div>
          <Suspense fallback={<LoadingSkeleton label="お知らせを読み込み中" />}>
            <NotificationsPanel
              key={initialNotice}
              initialNotice={initialNotice}
              onNavigate={() => close()}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
