import { CollectionsPanel } from './CollectionsPanel';
import { LoadMoreButton } from '../../components/LoadMoreButton';
import { LoadingSkeleton } from '../../components/Loading';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { skipToken, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import type { LibraryPageDto, StatsDto } from '../../contracts/library.generated';
import { LiveWorkCard } from '../discovery/LiveWorkCard';
import { libraryMessage } from './client';
import { LibraryEntry } from './LibraryEntry';
import { HistoryDeleteDialog } from './HistoryDeleteDialog';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { cacheLibraryStats, libraryStatsKey } from './cache';
import { visitStreak } from '../offline/store';
import styles from './LibraryPage.module.css';
export default function LibraryPage() {
  const { session, request, offline, cacheSession } = useAuth(),
    query = useQueryClient();
  const [kind, setKind] = useState<'history' | 'favorites' | 'collections'>('history'),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<SearchWorkDto | null>(null),
    [streak, setStreak] = useState<number | null>(null);
  const data = useInfiniteQuery({
    queryKey: ['library', session?.uid, kind],
    enabled: !!session && !offline && kind !== 'collections',
    initialPageParam: '',
    queryFn: async ({ pageParam, signal }) => {
      const page = await request<LibraryPageDto>(
        `/api/${kind}${pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''}`,
        { signal },
      );
      if (!signal.aborted && session) cacheLibraryStats(query, session.uid, page.stats);
      return page;
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  // Both tabs and view/delete responses feed the same account-scoped totals.
  const { data: stats } = useQuery<StatsDto>({
    queryKey: libraryStatsKey(session?.uid),
    queryFn: skipToken,
    enabled: false,
    gcTime: 5 * 60_000,
  });
  useEffect(() => {
    if (cacheSession && stats?.serverTime)
      void visitStreak(cacheSession, stats.serverTime)
        .then(setStreak)
        .catch(() => {});
  }, [cacheSession, stats?.serverTime]);
  const items = [
    ...new Map(
      (data.data?.pages ?? [])
        .flatMap((page) => page.items)
        .map((item) => [item.work.documentID, item]),
    ).values(),
  ].sort((a, b) =>
    kind === 'history'
      ? Date.parse(b.viewedAt ?? '') - Date.parse(a.viewedAt ?? '')
      : b.work.documentID.localeCompare(a.work.documentID),
  );
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const day =
      kind === 'history' && item.viewedAt
        ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(
            new Date(item.viewedAt),
          )
        : '';
    const group = groups.get(day) ?? [];
    group.push(item);
    groups.set(day, group);
  }
  return (
    <div className="page-container">
      <header className="sr-only">
        <h1 className="sr-only">ライブラリ</h1>
      </header>
      {offline ? (
        <p role="status">
          履歴・お気に入り・コレクションはオンラインで確認できます。
          <Link to="/saved">履歴の管理を開く</Link>
        </p>
      ) : (
        <>
          <section className={styles.stats} aria-label="閲覧の記録">
            {[
              ['今日', stats?.today],
              ['直近7日', stats?.week],
              ['これまで', stats?.total],
            ].map(([label, count]) => (
              <div key={label}>
                <span>{label}</span>
                <b>
                  {count ?? '—'}
                  <small>件</small>
                </b>
              </div>
            ))}
          </section>
          {data.isError && !stats && (
            <p className={styles.note} role="status">
              閲覧数を取得できませんでした。
            </p>
          )}
          <p className="sr-only">
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
            <button aria-pressed={kind === 'collections'} onClick={() => setKind('collections')}>
              コレクション
            </button>
          </div>
          {kind === 'collections' ? (
            <CollectionsPanel />
          ) : (
            <>
              {data.isPending && (
                <LoadingSkeleton
                  label="ライブラリを読み込み中"
                  cards
                  count={6}
                  className={styles.grid}
                />
              )}
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
                  {[...groups].map(([day, entries]) => (
                    <section key={day || 'undated'} className={styles.dayGroup}>
                      {kind === 'history' && (
                        <h2 className={styles.dayHeading}>
                          {day ? (
                            <time dateTime={day}>
                              {Number(day.slice(5, 7))}/{Number(day.slice(8, 10))}
                            </time>
                          ) : (
                            '日付不明'
                          )}
                        </h2>
                      )}
                      <div className={styles.grid}>
                        {entries.map((item) => (
                          <LibraryEntry
                            key={item.work.documentID}
                            onRemove={() => {
                              setMessage('');
                              setSelected(item.work);
                            }}
                          >
                            <LiveWorkCard
                              work={item.work}
                              from="/library"
                              extraAction={
                                <button
                                  className={`icon-button ${styles.removeButton}`}
                                  onClick={() => {
                                    setMessage('');
                                    setSelected(item.work);
                                  }}
                                  aria-label={`${item.work.title}の履歴を削除`}
                                >
                                  <Trash2 size={17} />
                                </button>
                              }
                            />
                          </LibraryEntry>
                        ))}
                      </div>
                    </section>
                  ))}
                  {!data.data.pages.some((p) => p.items.length > 0) && (
                    <p className="empty-state">
                      {kind === 'history'
                        ? 'まだ閲覧履歴はありません。PDFを開くと記録されます。'
                        : 'まだお気に入りはありません。作品の詳細から追加できます。'}
                    </p>
                  )}
                  {data.hasNextPage && (
                    <LoadMoreButton
                      loading={data.isFetchingNextPage}
                      onClick={() => void data.fetchNextPage()}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {selected && (
        <HistoryDeleteDialog
          work={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            setMessage('作品をライブラリから削除しました。');
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
