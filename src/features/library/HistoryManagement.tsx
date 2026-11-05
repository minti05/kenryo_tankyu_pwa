import { useQuery } from '@tanstack/react-query';
import type { StatsDto } from '../../contracts/library.generated';
import { libraryStatsKey } from './cache';
import { useEffect, useState } from 'react';
import { Check, History, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/context';
import { HistoryDeleteDialog } from './HistoryDeleteDialog';
import styles from './HistoryManagement.module.css';

export function HistoryManagement() {
  const { offline, session, request } = useAuth();
  const { data: stats } = useQuery<StatsDto>({
    queryKey: libraryStatsKey(session?.uid),
    queryFn: ({ signal }) => request<StatsDto>('/api/stats', { signal }),
    enabled: !!session && !offline,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(false), 2000);
    return () => clearTimeout(timer);
  }, [deleted]);
  return (
    <section className={styles.card} aria-label="閲覧履歴の管理">
      <div className={styles.heading}>
        <span className={styles.icon}>
          <History size={24} strokeWidth={1.6} />
        </span>
        <h2>閲覧履歴</h2>
        {offline && <span className={styles.badge}>オフライン</span>}
      </div>
      <p className={styles.metrics} aria-label="閲覧履歴の件数">
        <span>
          <strong>{stats?.total ?? '—'}</strong> 件
        </span>
      </p>
      <button
        className={styles.clear}
        aria-label="閲覧履歴をまとめて削除"
        disabled={offline || !session}
        onClick={() => {
          setDeleted(false);
          setConfirming(true);
        }}
      >
        {deleted ? (
          <>
            <Check size={17} />
            削除しました
          </>
        ) : (
          <>
            <Trash2 size={17} />
            まとめて削除
          </>
        )}
      </button>
      {deleted && (
        <p className="sr-only" role="status">
          削除しました
        </p>
      )}
      {confirming && (
        <HistoryDeleteDialog
          onClose={() => setConfirming(false)}
          onDeleted={() => {
            setConfirming(false);
            setDeleted(true);
          }}
        />
      )}
    </section>
  );
}
