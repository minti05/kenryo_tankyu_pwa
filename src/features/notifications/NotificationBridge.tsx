import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import { subscribeCache } from '../offline/store';
export function NotificationBridge() {
  const { cacheSession, request, offline } = useAuth(),
    query = useQueryClient(),
    [id, setId] = useState('');
  const call = useRef(request);
  useEffect(() => {
    call.current = request;
  }, [request]);
  useEffect(() => {
    if (!cacheSession || offline) return;
    let alive = true,
      off = () => {};
    const onNotice = (notice: string) => {
      if (alive) {
        setId(notice);
        void query.invalidateQueries({ queryKey: ['notifications'] });
      }
    };
    void import('./runtime').then(async (sdk) => {
      await sdk.refreshPush(cacheSession, (p, o) => call.current(p, o)).catch(() => {});
      const stop = await sdk.foreground(cacheSession, onNotice).catch(() => () => {});
      if (alive) off = stop;
      else stop();
    });
    const focus = () => {
      void import('./runtime')
        .then((sdk) => sdk.refreshPush(cacheSession, (p, o) => call.current(p, o)))
        .catch(() => {});
    };
    const changed = () => {
      off();
      void import('./runtime')
        .then((sdk) => sdk.foreground(cacheSession, onNotice))
        .then((stop) => {
          if (alive) off = stop;
          else stop();
        })
        .catch(() => {});
    };
    const unsubscribe = subscribeCache(changed);
    window.addEventListener('focus', focus);
    return () => {
      alive = false;
      off();
      unsubscribe();
      window.removeEventListener('focus', focus);
    };
  }, [cacheSession, offline, query]);
  if (!id || !cacheSession || offline) return null;
  return (
    <aside className="update-notice" role="status">
      <p>新しいお知らせがあります。</p>
      <Link to={'/notifications?open=' + encodeURIComponent(id)} onClick={() => setId('')}>
        お知らせを確認
      </Link>
      <button className="button quiet" onClick={() => setId('')}>
        閉じる
      </button>
    </aside>
  );
}
