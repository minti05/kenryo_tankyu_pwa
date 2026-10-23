import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { NoticesDto, NoticeDto } from '../../contracts/notifications.generated';
import { useAuth } from '../auth/context';
import { PushSettings } from './PushSettings';
import './notifications.css';
export default function NotificationsPage() {
  const [params] = useSearchParams();
  const id = params.get('open');
  return (
    <Navigate
      to={
        id && /^[A-Za-z0-9_-]{1,128}$/.test(id)
          ? `/home?notice=${encodeURIComponent(id)}`
          : '/home?notices=1'
      }
      replace
    />
  );
}
export function NotificationsPanel({
  initialNotice = null,
  onNavigate,
}: {
  initialNotice?: string | null;
  onNavigate: () => void;
}) {
  const { request, session, offline } = useAuth();
  const [open, setOpen] = useState(initialNotice);
  const data = useInfiniteQuery({
    queryKey: ['notifications', session?.uid],
    enabled: !offline,
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      request<NoticesDto>(
        '/api/notifications' + (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''),
      ),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    staleTime: 0,
  });
  const items = data.data?.pages.flatMap((p) => p.items) ?? [];
  const index = items.findIndex((n) => n.id === open);
  async function nextNotice() {
    if (items[index + 1]) setOpen(items[index + 1]!.id);
    else if (data.hasNextPage) {
      const response = await data.fetchNextPage();
      const next = response.data?.pages.flatMap((p) => p.items)[index + 1];
      if (next) setOpen(next.id);
    }
  }
  return (
    <div className="notification-panel-content">
      <div className="notification-toggle">
        <PushSettings compact />
      </div>
      {import.meta.env.VITE_NOTIFICATION_ACCEPTANCE === 'true' && <TestControls />}
      {offline ? (
        <p role="status">お知らせはオンラインで確認できます。</p>
      ) : (
        <>
          {data.isPending && <p role="status">お知らせを読み込んでいます…</p>}
          {data.isError && (
            <div role="alert">
              <p>お知らせを取得できませんでした。</p>
              <button className="button quiet" onClick={() => void data.refetch()}>
                お知らせを読み直す
              </button>
            </div>
          )}
          {open ? (
            <>
              <button className="notice-back button quiet" onClick={() => setOpen(null)}>
                <ArrowLeft size={16} />
                お知らせ一覧
              </button>
              <NoticeDetail key={open} id={open} onNavigate={onNavigate} />
              <div className="notice-pager">
                <button
                  className="button quiet"
                  disabled={index <= 0}
                  onClick={() => setOpen(items[index - 1]!.id)}
                >
                  <ArrowLeft size={16} />
                  前のお知らせ
                </button>
                <button
                  className="button quiet"
                  disabled={
                    index < 0 || (!items[index + 1] && !data.hasNextPage) || data.isFetchingNextPage
                  }
                  onClick={() => void nextNotice()}
                >
                  次のお知らせ
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="notice-list" aria-label="お知らせ一覧">
                {items.map((n) => (
                  <article key={n.id}>
                    <button className="notice-item" onClick={() => setOpen(n.id)}>
                      <span
                        className={n.read ? 'notice-read' : 'notice-unread'}
                        aria-label={n.read ? '既読' : '未読'}
                      />
                      <span>
                        <time>
                          {new Date(n.createdAt).toLocaleDateString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                          })}
                        </time>
                        <strong>{n.title}</strong>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </section>
              {data.data && !items.length && (
                <p className="notice-empty">お知らせはまだありません。</p>
              )}
              {data.hasNextPage && (
                <button
                  className="button quiet notice-more"
                  disabled={data.isFetchingNextPage}
                  onClick={() => void data.fetchNextPage()}
                >
                  {data.isFetchingNextPage ? '読み込み中…' : '以前のお知らせを見る'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function NoticeDetail({ id, onNavigate }: { id: string; onNavigate: () => void }) {
  const { request, session } = useAuth(),
    query = useQueryClient(),
    call = useRef(request),
    [error, setError] = useState(false);
  useEffect(() => {
    call.current = request;
  }, [request]);
  const item = useQuery({
    queryKey: ['notice', session?.uid, id],
    queryFn: () => request<NoticeDto>('/api/notifications/' + id),
    staleTime: 0,
  });
  async function mark() {
    try {
      await call.current('/api/notification-reads/' + id, { method: 'PUT', body: '{}' });
      setError(false);
      void query.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    if (!item.data) return;
    let alive = true;
    void call
      .current('/api/notification-reads/' + id, { method: 'PUT', body: '{}' })
      .then(() => {
        if (alive) {
          setError(false);
          void query.invalidateQueries({ queryKey: ['notifications'] });
        }
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [item.data, id, query]);
  if (item.isPending) return <p role="status">お知らせの内容を読み込んでいます…</p>;
  if (item.isError)
    return (
      <div role="alert">
        <p>このお知らせを表示できません。</p>
        <button className="button secondary" onClick={() => void item.refetch()}>
          内容を読み直す
        </button>
      </div>
    );
  return (
    <section className="notice-detail" aria-label="お知らせの内容">
      <h2>{item.data.title}</h2>
      <p>{item.data.body}</p>
      {item.data.workId && (
        <Link className="button secondary" onClick={onNavigate} to={'/works/' + item.data.workId}>
          関連する作品を開く
        </Link>
      )}
      {error && (
        <p role="status">
          既読を記録できませんでした。
          <button className="button secondary" onClick={() => void mark()}>
            既読を再試行
          </button>
        </p>
      )}
    </section>
  );
}

function TestControls() {
  const { request } = useAuth(),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function send(delaySeconds: number) {
    setBusy(true);
    try {
      await request('/api/acceptance/test', {
        method: 'POST',
        body: JSON.stringify({ delaySeconds }),
      });
      setMessage(
        delaySeconds
          ? '15秒後に送ります。ホーム画面へ戻して、通知が届くか確認してください。'
          : '送信を受け付けました。この画面上の受信案内を確認してください。',
      );
    } catch {
      setMessage('テスト送信できませんでした。通知登録と通信を確認してください。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="notification-settings">
      <h2>Androidの接続テスト</h2>
      <p>通知を許可して登録した後、前景と背景の両方を確認してください。</p>
      <button className="button secondary" disabled={busy} onClick={() => void send(0)}>
        今すぐテスト通知
      </button>
      <button className="button secondary" disabled={busy} onClick={() => void send(15)}>
        15秒後にテスト通知
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
