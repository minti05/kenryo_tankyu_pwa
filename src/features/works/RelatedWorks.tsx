import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/context';
import { LiveWorkCard } from '../discovery/LiveWorkCard';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import styles from './SimilarWorks.module.css';
type Response = { items: { work: SearchWorkDto; similarity: number }[] };
export function RelatedWorks({ id, onNavigate }: { id: string; onNavigate?: () => void }) {
  const { session, request, offline } = useAuth(),
    location = useLocation();
  const [rotation, setRotation] = useState({
    seed: 0,
    exclude: [] as string[],
  });
  const previous = /^\/works\/(\d{8})/.exec(
    new URLSearchParams(location.search).get('from') ?? '',
  )?.[1];
  const exclude = [...new Set([...rotation.exclude, ...(previous ? [previous] : [])])];
  const related = useQuery({
    queryKey: ['related', session?.uid, id, rotation, previous],
    enabled: !!session && !offline,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: ({ signal }) =>
      request<Response>(
        `/api/works/${id}/similar?${new URLSearchParams({ seed: String(rotation.seed), exclude: exclude.join(',') })}`,
        { signal },
      ),
  });
  if (!session || offline) return null;
  return (
    <section className={styles.related} aria-label="関連する探究">
      <div className={styles.relatedHeading}>
        <h2>関連する探究</h2>
        <button
          className="icon-button"
          aria-label="ほかの候補を見る"
          disabled={related.isFetching || !related.data?.items.length}
          onClick={() =>
            setRotation({
              seed: Math.floor(Math.random() * 1000000) + 1,
              exclude: related.data?.items.map((i) => i.work.documentID) ?? [],
            })
          }
        >
          <RefreshCw size={17} />
        </button>
      </div>
      {related.isPending ? (
        <div className={styles.skeletons} role="status" aria-label="関連する探究を読み込み中">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : related.isError ? (
        <div className={styles.empty}>
          <p>関連する探究を表示できませんでした。</p>
          <button onClick={() => void related.refetch()}>再試行</button>
        </div>
      ) : related.data.items.length ? (
        <div
          className={styles.cards}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) onNavigate?.();
          }}
        >
          {related.data.items.map(({ work }) => (
            <LiveWorkCard key={work.documentID} work={work} from={location.pathname} />
          ))}
        </div>
      ) : (
        <p className={styles.noRelated}>関連する探究はまだありません。</p>
      )}
    </section>
  );
}
