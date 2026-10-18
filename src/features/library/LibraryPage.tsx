import { useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import type { LibraryPageDto, StatsDto } from '../../contracts/library.generated';
import { LiveWorkCard } from '../discovery/LiveWorkCard';
import { libraryMessage, retryableIntent } from './client';
import { visitStreak } from '../offline/store';
import styles from './LibraryPage.module.css';
export default function LibraryPage() {
  const { session, request, offline, cacheSession } = useAuth(),
    query = useQueryClient();
  const [kind, setKind] = useState<'history' | 'favorites'>('history'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [scope, setScope] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [streak, setStreak] = useState<number | null>(null);
  const intent = useRef(retryableIntent());
  const stats = useQuery({
    queryKey: ['stats', session?.uid],
    enabled: !offline,
    queryFn: async () => {
      const value = await request<StatsDto>('/api/stats');
      if (cacheSession)
        void visitStreak(cacheSession, value.serverTime)
          .then(setStreak)
          .catch(() => {});
      return value;
    },
    staleTime: 0,
  });
  const data = useInfiniteQuery({
    queryKey: ['library', session?.uid, kind],
    enabled: !offline,
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      request<LibraryPageDto>(
        `/api/${kind}${pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''}`,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
  });
  async function remove(id?: string) {
    if (busy) return;
    if (
      !confirm(
        id
          ? 'この作品の閲覧履歴とお気に入りを削除します。よろしいですか？'
          : '閲覧履歴を削除します。お気に入りと端末の保存は残ります。よろしいですか？',
      )
    )
      return;
    let body: Record<string, unknown> = {};
    if (!id) {
      body = { scope };
      if (scope === 'period') {
        const start = Date.parse(from + 'T00:00:00+09:00'),
          end = Date.parse(to + 'T00:00:00+09:00') + 86400000;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
          setMessage('削除する期間を正しく選んでください。');
          return;
        }
        body = { scope, from: new Date(start).toISOString(), to: new Date(end).toISOString() };
      }
    }
    const path = '/api/history' + (id ? '/' + id : '');
    setBusy(true);
    setMessage('');
    try {
      await request(path, {
        method: 'DELETE',
        body: JSON.stringify({ ...body, ...intent.current({ path, body }) }),
      });
      await Promise.all([
        query.invalidateQueries({ queryKey: ['library'] }),
        query.invalidateQueries({ queryKey: ['stats'] }),
        query.invalidateQueries({ queryKey: ['favorite'] }),
      ]);
      intent.current.clear();
      setMessage('閲覧履歴を削除しました。');
    } catch (error) {
      setMessage(libraryMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-container">
      <header className={styles.header}>
        <span className="eyebrow">YOUR COLLECTION</span>
        <h1>問いの足あと</h1>
        <p>気になった探究と、これまでの出会いを手元に。</p>
        <Link to="/saved">この端末に保存した資料 →</Link>
      </header>
      {offline ? (
        <p role="status">
          履歴とお気に入りはオンラインで確認できます。<Link to="/saved">端末の保存を開く</Link>
        </p>
      ) : (
        <>
          <section className={styles.stats} aria-label="閲覧の記録">
            {stats.data ? (
              <>
                <div>
                  <b>{stats.data.today}</b>今日
                </div>
                <div>
                  <b>{stats.data.week}</b>直近7日
                </div>
                <div>
                  <b>{stats.data.total}</b>これまで
                </div>
              </>
            ) : (
              <p>統計を{stats.isError ? '取得できませんでした。' : '確認しています…'}</p>
            )}
          </section>
          <p className={styles.note}>
            最後に閲覧した日時による作品数です。同じ作品を何度開いても1作品として数えます（日本時間）。
            {streak !== null && ` この端末でライブラリを連続して開いた日数：${streak}日。`}
          </p>
          <div className={styles.tabs} role="group" aria-label="ライブラリの種類">
            <button aria-pressed={kind === 'history'} onClick={() => setKind('history')}>
              閲覧履歴
            </button>
            <button aria-pressed={kind === 'favorites'} onClick={() => setKind('favorites')}>
              お気に入り
            </button>
          </div>
          {data.isPending && <p role="status">ライブラリを読み込んでいます…</p>}
          {data.isError && (
            <div role="alert">
              <p>{libraryMessage(data.error)}</p>
              <button className="button secondary" onClick={() => void data.refetch()}>
                ライブラリを読み直す
              </button>
            </div>
          )}
          {data.data && (
            <>
              <div className={styles.grid}>
                {data.data.pages
                  .flatMap((p) => p.items)
                  .map((item) => (
                    <div key={item.work.documentID}>
                      <LiveWorkCard work={item.work} from="/library" />
                      {item.viewedAt && (
                        <p className={styles.note}>
                          {new Date(item.viewedAt).toLocaleDateString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                          })}
                          に閲覧
                        </p>
                      )}
                      {kind === 'history' && (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => void remove(item.work.documentID)}
                          aria-label={`${item.work.title}の履歴を削除`}
                        >
                          履歴を削除
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              {!data.data.pages.some((p) => p.items.length > 0) && (
                <p className="empty-state">
                  {kind === 'history'
                    ? 'まだ閲覧履歴はありません。PDFを開くと記録されます。'
                    : 'まだお気に入りはありません。作品の詳細から追加できます。'}
                </p>
              )}
              {data.hasNextPage && (
                <button
                  className="button secondary"
                  disabled={data.isFetchingNextPage}
                  onClick={() => void data.fetchNextPage()}
                >
                  続きを見る
                </button>
              )}
            </>
          )}
          {kind === 'history' && (
            <details className={styles.manage}>
              <summary>閲覧履歴を整理する</summary>
              <p>
                お気に入りと端末に保存した資料は残ります。1作品ずつ削除した場合は、その作品のお気に入りも外れます。
              </p>
              <label>
                削除範囲
                <select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="all">すべて</option>
                  <option value="period">期間を指定</option>
                </select>
              </label>
              {scope === 'period' && (
                <>
                  <label>
                    開始日
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label>
                    終了日
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </>
              )}
              <button className="button secondary" disabled={busy} onClick={() => void remove()}>
                閲覧履歴をまとめて削除
              </button>
            </details>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
