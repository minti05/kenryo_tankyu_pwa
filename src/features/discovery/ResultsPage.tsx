import { LoadMoreButton } from '../../components/LoadMoreButton';
import { LoadingSkeleton } from '../../components/Loading';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { searchHistorySaveKey } from './search-history';
import { clearResultsPosition, useResultsPosition } from './results-position';
import { X, ArrowDownWideNarrow } from 'lucide-react';
import { SearchFilters } from './SearchFilters';
import { conditionLabels, hasSearchConditions, SORT_OPTIONS } from './filter-options';
import { useAuth } from '../auth/context';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import type { SearchPageDto } from '../../contracts/discovery.generated';
import { LiveWorkCard } from './LiveWorkCard';
import { ApiError } from '../../lib/api-client';
import styles from './PreviewRoutes.module.css';
import './discovery.css';
function failure(e: unknown) {
  if (e instanceof ApiError && e.code === 'invalid_cursor')
    return '続きを読み込む期限が切れました。検索し直してください。';
  return e instanceof ApiError && e.status === 400
    ? '検索条件を確認してください。キーワードは100文字・10語までです。'
    : '読み込めませんでした。通信を確認して、もう一度お試しください。';
}
export default function ResultsPage({ awards = false }: { awards?: boolean }) {
  const { offline } = useAuth();
  if (offline)
    return (
      <div className="page-container empty-state">
        <h1>オフラインです</h1>
        <p>新しい作品を探すには通信に接続してください。</p>
        <Link className="button secondary" to="/saved">
          履歴の管理を開く
        </Link>
      </div>
    );
  return <OnlineResults awards={awards} />;
}
function OnlineResults({ awards }: { awards: boolean }) {
  const { session, request } = useAuth(),
    [params, setParams] = useSearchParams(),
    location = useLocation();
  const raw = params.toString(),
    q = params.get('q') || '',
    category = CATEGORY_CATALOG.find((c) => c.id === params.get('category'));
  const subcategory = category?.subcategories.find((s) => s.id === params.get('subcategory'));
  const canSearch = hasSearchConditions(params, awards);
  const endpoint = awards ? '/api/awards' : '/api/works';
  const works = useInfiniteQuery({
    queryKey: ['works', session?.uid, endpoint, raw],
    enabled: !!session && canSearch,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const p = new URLSearchParams(raw);
      p.delete('cursor');
      if (pageParam) p.set('cursor', pageParam);
      return request<SearchPageDto>(`${endpoint}?${p}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Keep the loaded pages when returning from a work. PDF access still revalidates publication.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const items = [
    ...new Map(
      works.data?.pages.flatMap((p) => p.items).map((w) => [w.documentID, w]) ?? [],
    ).values(),
  ];
  useResultsPosition(session?.uid, endpoint, params, works);
  const savedHistory = useQuery<{ error: string }>({
    queryKey: searchHistorySaveKey(session?.uid, params, awards),
    queryFn: skipToken,
  });
  function apply(next: URLSearchParams) {
    next.delete('cursor');
    clearResultsPosition(session?.uid, endpoint, next);
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const conditions = conditionLabels(params);
  const historyError = savedHistory.data?.error ?? '';
  return (
    <div className="page-container results-page">
      <h1 className="sr-only">
        {awards
          ? 'KRGP受賞作品'
          : q
            ? `「${q}」の検索結果`
            : [category?.label, subcategory?.label].filter(Boolean).join(' / ') || '作品を探す'}
      </h1>
      {historyError && <p role="status">{historyError}</p>}
      <div className="results-controls">
        <div className="results-toolbar">
          <SearchFilters params={params} awards={awards} onApply={apply} />
          <label className="results-sort">
            <ArrowDownWideNarrow size={18} />
            <span className="sr-only">並び順</span>
            <select
              aria-label="並び順"
              value={params.get('sort') ?? 'likes'}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set('sort', e.target.value);
                apply(next);
              }}
            >
              {SORT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!!conditions.length && (
          <div className="condition-chips" aria-label="適用中の検索条件">
            {conditions.map(({ key, label }) => (
              <button
                type="button"
                key={key}
                aria-label={`${label}の条件を解除`}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete(key);
                  if (key === 'category') next.delete('subcategory');
                  apply(next);
                }}
              >
                <span>{label}</span>
                <X size={14} />
              </button>
            ))}
          </div>
        )}
      </div>
      <section className={styles.results} aria-labelledby="live-results">
        <div className={styles.resultsHeader}>
          <h2 id="live-results">{awards ? '受賞した探究' : '作品一覧'}</h2>
          {canSearch && !works.isPending && <span role="status">{items.length}作品を表示</span>}
        </div>
        {!canSearch ? (
          <div className="empty-state">
            <p>キーワードか条件を選んで検索してください。</p>
            <Link className="button secondary" to="/search">
              検索する
            </Link>
          </div>
        ) : works.isPending ? (
          <LoadingSkeleton
            label="作品一覧を読み込み中"
            cards
            count={6}
            className={styles.workGrid}
          />
        ) : works.isError && !items.length ? (
          <div role="alert">
            <p>{failure(works.error)}</p>
            <button className="button secondary" onClick={() => void works.refetch()}>
              もう一度試す
            </button>
          </div>
        ) : (
          <>
            {works.isError && <p role="alert">{failure(works.error)}</p>}
            {items.length ? (
              <div className={styles.workGrid}>
                {items.map((w) => (
                  <LiveWorkCard
                    key={w.documentID}
                    work={w}
                    from={location.pathname + location.search}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>
                  {works.hasNextPage
                    ? '公開情報を確認しながら探しています。'
                    : 'この条件の作品は見つかりませんでした。'}
                </h3>
                {q && !works.hasNextPage ? (
                  <Link
                    className="button secondary"
                    to={`/search/chat?${new URLSearchParams({ q })}`}
                  >
                    AIで探す
                  </Link>
                ) : (
                  <p>キーワードを短くしたり、絞り込みを減らしてみてください。</p>
                )}
              </div>
            )}
            {works.hasNextPage && (
              <LoadMoreButton
                loading={works.isFetchingNextPage}
                onClick={() => void works.fetchNextPage()}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
