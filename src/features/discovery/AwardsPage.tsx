import { awardsQueryKey, awardsView, AWARDS_FRESH_MS } from './awards-cache';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownWideNarrow, RefreshCw, X } from 'lucide-react';
import type { SearchPageDto } from '../../contracts/discovery.generated';
import { useAuth } from '../auth/context';
import { LiveWorkCard } from './LiveWorkCard';
import { SearchFilters } from './SearchFilters';
import { AWARDS, conditionLabels, SORT_OPTIONS } from './filter-options';
import grid from './PreviewRoutes.module.css';
import './discovery.css';
import './awards.css';

export default function AwardsPage() {
  const { offline } = useAuth();
  if (offline)
    return (
      <div className="page-container empty-state">
        <p>受賞作品を探すには通信に接続してください。</p>
        <Link to="/saved" className="button secondary">
          端末の保存を開く
        </Link>
      </div>
    );
  return <AwardsCollection />;
}
function AwardsCollection() {
  const { session, request } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const raw = params.toString();
  const positionKey = `krgp-position:${session?.uid}:${raw}`;
  const restored = useRef('');
  const works = useQuery({
    queryKey: awardsQueryKey(session?.uid),
    enabled: !!session,
    queryFn: ({ signal }) => request<SearchPageDto>('/api/awards/collection', { signal }),
    staleTime: AWARDS_FRESH_MS,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const savedPosition = useMemo(() => readPosition(positionKey), [positionKey]);
  const [pagination, setPagination] = useState(() => ({ raw, count: savedPosition.count }));
  const visibleCount = pagination.raw === raw ? pagination.count : savedPosition.count;
  let invalid = false;
  let view: ReturnType<typeof awardsView> | undefined;
  try {
    view = awardsView(works.data?.items ?? [], params);
  } catch {
    invalid = true;
  }
  const overview = works.data ? view?.overview : undefined;
  const allItems = view?.items ?? [];
  const items = allItems.slice(0, visibleCount);
  const year = params.get('year') ?? '';
  const award = params.get('award') ?? '';
  const count = overview?.prizes.reduce((sum, p) => sum + p.count, 0);
  const conditions = conditionLabels(params).filter(
    (c) => !['year', 'award', 'awardName'].includes(c.key),
  );
  useEffect(() => {
    if (!works.data || restored.current === positionKey) return;
    restored.current = positionKey;
    let y = 0;
    try {
      y = readPosition(positionKey).top;
    } catch {
      /* optional */
    }
    const frame = requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [works.data, positionKey]);
  function apply(next: URLSearchParams) {
    next.delete('cursor');
    try {
      sessionStorage.removeItem(`krgp-position:${session?.uid}:${next.toString()}`);
    } catch {
      /* optional */
    }
    restored.current = '';
    setPagination({ raw: next.toString(), count: 20 });
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function choose(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'year') next.delete('awardName');
    apply(next);
  }
  return (
    <div className="page-container awards-page">
      <h1 className="sr-only">KRGP受賞作品</h1>
      <div className="awards-layout">
        <aside className="awards-browser" aria-label="開催年と賞で選ぶ">
          <nav className="award-editions" aria-label="KRGP開催年">
            <span className="awards-control-label">開催年</span>
            <div className="award-options">
              <button aria-pressed={!year} onClick={() => choose('year', '')}>
                すべて
                {overview && (
                  <small>{overview.editions.reduce((sum, e) => sum + e.count, 0)}</small>
                )}
              </button>
              {overview?.editions.map((e) => (
                <button
                  key={e.enterYear}
                  aria-pressed={year === String(e.enterYear)}
                  onClick={() => choose('year', String(e.enterYear))}
                >
                  <span>KRGP {e.enterYear + 1}</span>
                  <small>{e.count}</small>
                </button>
              ))}
            </div>
          </nav>
          <nav className="award-prizes" aria-label="KRGPの賞">
            <span className="awards-control-label">賞</span>
            <div className="award-options">
              <button aria-pressed={!award} onClick={() => choose('award', '')}>
                すべての賞
              </button>
              {AWARDS.map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={award === id}
                  onClick={() => choose('award', id ?? '')}
                >
                  <span>{label}</span>
                  {overview && (
                    <small>
                      {overview.prizes.find((p) => String(p.awardType) === id)?.count ?? 0}
                    </small>
                  )}
                </button>
              ))}
            </div>
          </nav>
          {(!!overview?.names.length || !!params.get('awardName')) && (
            <label className="award-named">
              <span className="awards-control-label">賞名</span>
              <select
                aria-label="KRGPの賞名"
                value={params.get('awardName') ?? ''}
                onChange={(e) => choose('awardName', e.target.value)}
              >
                <option value="">すべての賞名</option>
                {params.get('awardName') &&
                  !overview?.names.some((n) => n.name === params.get('awardName')) && (
                    <option value={params.get('awardName')!}>{params.get('awardName')}</option>
                  )}
                {overview?.names.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}（{n.count}）
                  </option>
                ))}
              </select>
            </label>
          )}
        </aside>
        <section className="awards-content" aria-label="受賞作品一覧">
          <div className="awards-tools">
            <div className="awards-edition-summary">
              {year ? `${year}年度入学` : 'すべての開催年'}
              {count !== undefined && <span>受賞 {count}作品</span>}
            </div>
            <div className="awards-tool-actions">
              <button
                className="icon-button"
                aria-label="作品情報を更新"
                title="作品情報を更新"
                disabled={works.isFetching}
                onClick={() => void works.refetch()}
              >
                <RefreshCw size={18} />
              </button>
              <SearchFilters params={params} awards={false} onApply={apply} />
              <label className="results-sort">
                <ArrowDownWideNarrow size={18} />
                <span className="sr-only">並び順</span>
                <select
                  aria-label="並び順"
                  value={params.get('sort') ?? 'likes'}
                  onChange={(e) => choose('sort', e.target.value)}
                >
                  {SORT_OPTIONS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!!conditions.length && (
              <div className="condition-chips" aria-label="適用中の検索条件">
                {conditions.map((c) => (
                  <button
                    key={c.key}
                    aria-label={`${c.label}の条件を解除`}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete(c.key);
                      if (c.key === 'category') next.delete('subcategory');
                      apply(next);
                    }}
                  >
                    <span>{c.label}</span>
                    <X size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
          {invalid ? (
            <p role="alert">検索条件を確認してください。</p>
          ) : works.isPending ? (
            <p className="awards-status" role="status">
              受賞作品を読み込んでいます…
            </p>
          ) : works.isError ? (
            <div className="empty-state" role="alert">
              <p>受賞作品を取得できませんでした。</p>
              <button className="button secondary" onClick={() => void works.refetch()}>
                もう一度試す
              </button>
            </div>
          ) : (
            <>
              <div
                className={`${grid.workGrid} awards-grid`}
                onClickCapture={(event) => {
                  if ((event.target as Element).closest('a[href^="/works/"]'))
                    try {
                      sessionStorage.setItem(
                        positionKey,
                        JSON.stringify({ top: window.scrollY, count: visibleCount }),
                      );
                    } catch {
                      /* optional */
                    }
                }}
              >
                {items.map((work) => (
                  <LiveWorkCard
                    key={work.documentID}
                    work={work}
                    from={location.pathname + location.search}
                    showAwardDetails
                  />
                ))}
              </div>
              {!items.length && (
                <div className="empty-state">
                  <p>この条件の受賞作品はありません。</p>
                  <button className="button secondary" onClick={() => apply(new URLSearchParams())}>
                    条件をリセット
                  </button>
                </div>
              )}
              {!!items.length && (
                <p className="awards-loaded" role="status">
                  {items.length}作品を表示
                </p>
              )}
              {allItems.length > visibleCount && (
                <button
                  className="button secondary"
                  onClick={() => setPagination({ raw, count: visibleCount + 20 })}
                >
                  さらに表示
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function readPosition(key: string): { top: number; count: number } {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (typeof value === 'number' && Number.isFinite(value))
      return { top: Math.max(0, value), count: 20 };
    if (
      value &&
      typeof value === 'object' &&
      'top' in value &&
      'count' in value &&
      typeof value.top === 'number' &&
      Number.isFinite(value.top) &&
      typeof value.count === 'number' &&
      Number.isInteger(value.count)
    )
      return { top: Math.max(0, value.top), count: Math.min(2000, Math.max(20, value.count)) };
  } catch {
    /* Position storage is optional. */
  }
  return { top: 0, count: 20 };
}
