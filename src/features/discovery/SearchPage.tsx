import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ArrowRight, RotateCcw } from 'lucide-react';
import { useAuth } from '../auth/context';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import type { SearchPageDto, SearchHistoryPageDto } from '../../contracts/discovery.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { LiveWorkCard } from './LiveWorkCard';
import { ApiError } from '../../lib/api-client';
import styles from './PreviewRoutes.module.css';
function failure(e: unknown) {
  if (e instanceof ApiError && e.code === 'invalid_cursor')
    return '続きを読み込む期限が切れました。検索し直してください。';
  return e instanceof ApiError && e.status === 400
    ? '検索条件を確認してください。キーワードは100文字・10語までです。'
    : '読み込めませんでした。通信を確認して、もう一度お試しください。';
}
export default function SearchPage({ awards = false }: { awards?: boolean }) {
  const { session, request } = useAuth(),
    queryClient = useQueryClient(),
    [params, setParams] = useSearchParams(),
    location = useLocation(),
    [expanded, setExpanded] = useState(false),
    [historyError, setHistoryError] = useState(''),
    [confirmClear, setConfirmClear] = useState(false);
  const raw = params.toString(),
    selected = params.get('category') ?? '',
    q = params.get('q') ?? '',
    category = CATEGORY_CATALOG.find((c) => c.id === selected);
  const endpoint = awards ? '/api/awards' : '/api/works';
  const works = useInfiniteQuery({
    queryKey: ['works', session?.uid, endpoint, raw],
    enabled: !!session,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const p = new URLSearchParams(raw);
      p.delete('cursor');
      if (pageParam) p.set('cursor', pageParam);
      return request<SearchPageDto>(`${endpoint}?${p}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const history = useQuery({
    queryKey: ['search-history', session?.uid],
    enabled: !!session,
    queryFn: ({ signal }) => request<SearchHistoryPageDto>('/api/search-history', { signal }),
    staleTime: 0,
    gcTime: 0,
  });
  const recommended = useQuery({
    queryKey: ['discovery', session?.uid],
    enabled: !!session && !awards && !raw,
    queryFn: ({ signal }) => request<SearchPageDto>('/api/discovery', { signal }),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete('cursor');
    if (key === 'category') next.delete('subcategory');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }
  async function saveHistory(next: URLSearchParams) {
    if (awards) next.set('awardsOnly', '1');
    next.delete('cursor');
    next.delete('limit');
    try {
      await request('/api/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: next.toString() }),
      });
      await queryClient.invalidateQueries({ queryKey: ['search-history', session?.uid] });
      setHistoryError('');
    } catch (e) {
      setHistoryError(
        e instanceof ApiError && e.code === 'history_full'
          ? '検索履歴が上限に達しました。不要な履歴を削除すると保存できます。'
          : '検索結果は表示できますが、履歴を保存できませんでした。',
      );
    }
  }
  async function deleteHistory(id?: string) {
    try {
      await request(`/api/search-history${id ? '?id=' + encodeURIComponent(id) : ''}`, {
        method: 'DELETE',
      });
      await queryClient.invalidateQueries({ queryKey: ['search-history', session?.uid] });
      setHistoryError('');
      setConfirmClear(false);
    } catch {
      setHistoryError('履歴を削除できませんでした。もう一度お試しください。');
    }
  }
  const items = [
    ...new Map(
      works.data?.pages.flatMap((p) => p.items).map((w) => [w.documentID, w]) ?? [],
    ).values(),
  ];
  return (
    <div className="page-container">
      <section className={styles.intro}>
        <div>
          <span className="eyebrow">
            {awards ? 'KENRYO RESEARCH GRAND PRIX' : 'DISCOVER A NEW PERSPECTIVE'}
          </span>
          <h1>{awards ? '問いが、ひらいた景色。' : '好奇心の、その先へ。'}</h1>
          <p>
            {awards ? 'KRGPで受賞した探究をたどる。' : '先輩の問いから、次の一歩を見つけよう。'}
          </p>
        </div>
        <Link className="text-link" to={awards ? '/explore' : '/awards'}>
          {awards ? '作品を探す' : 'KRGPを見る'}
          <ArrowRight size={17} />
        </Link>
      </section>
      <form
        className={styles.search}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('q') ?? '').trim(),
            next = new URLSearchParams(params);
          next.delete('cursor');
          if (value) next.set('q', value);
          else next.delete('q');
          setParams(next);
          if (value || [...next.keys()].some((k) => k !== 'sort')) void saveHistory(next);
        }}
      >
        <Search size={22} />
        <label className="sr-only" htmlFor="live-query">
          作品をキーワードで検索
        </label>
        <input
          key={q}
          id="live-query"
          name="q"
          defaultValue={q}
          maxLength={100}
          type="search"
          autoComplete="off"
          placeholder="気になることを、ことばにしてみる"
          list="search-ideas"
        />
        <datalist id="search-ideas">
          {(history.data?.items ?? [])
            .map((h) => new URLSearchParams(h.parameters).get('q'))
            .filter(Boolean)
            .map((s, i) => (
              <option key={i} value={s!} />
            ))}
          {CATEGORY_CATALOG.map((c) => (
            <option key={c.id} value={c.label} />
          ))}
        </datalist>
        <button className="button primary" type="submit">
          探す
          <ArrowRight size={16} />
        </button>
      </form>
      <section className={styles.themes}>
        <div className={styles.sectionHeading}>
          <h2>テーマから出会う</h2>
          <button
            className={styles.expandThemes}
            aria-expanded={expanded}
            aria-controls="live-themes"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '閉じる' : 'すべてのテーマ'}
          </button>
        </div>
        <div
          id="live-themes"
          className={`${styles.categories} ${expanded ? styles.categoriesExpanded : ''}`}
          role="group"
          aria-label="テーマで絞り込む"
        >
          <button
            aria-pressed={!selected}
            className={!selected ? styles.activeCategory : ''}
            onClick={() => update('category', '')}
          >
            <span className={styles.allThemes}>ALL</span>
            <span>すべて</span>
          </button>
          {CATEGORY_CATALOG.map((c) => (
            <button
              key={c.id}
              aria-pressed={selected === c.id}
              className={selected === c.id ? styles.activeCategory : ''}
              onClick={() => update('category', c.id)}
            >
              <CategoryArt category={c.id} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </section>
      <div className={`${styles.filters} ${styles.liveFilters}`}>
        <label>
          <span className="sr-only">サブカテゴリ</span>
          <select
            aria-label="サブカテゴリ"
            value={params.get('subcategory') ?? ''}
            disabled={!category}
            onChange={(e) => update('subcategory', e.target.value)}
          >
            <option value="">すべてのサブカテゴリ</option>
            {category?.subcategories.map((s) => (
              <option value={s.id} key={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">入学年度</span>
          <select
            aria-label="入学年度"
            value={params.get('year') ?? ''}
            onChange={(e) => update('year', e.target.value)}
          >
            <option value="">すべての年度</option>
            {Array.from(
              { length: Math.max(1, new Date().getFullYear() - 2019) },
              (_, i) => new Date().getFullYear() - i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}年度入学
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">学科</span>
          <select
            aria-label="学科"
            value={params.get('course') ?? ''}
            onChange={(e) => update('course', e.target.value)}
          >
            <option value="">すべての学科</option>
            <option value="tankyu">探究科</option>
            <option value="general">普通科</option>
          </select>
        </label>
        <label>
          <span className="sr-only">活動</span>
          <select
            aria-label="活動"
            value={params.get('event') ?? ''}
            onChange={(e) => update('event', e.target.value)}
          >
            <option value="">すべての活動</option>
            <option value="localLearning">信州学</option>
            <option value="individualTankyu">個人探究</option>
          </select>
        </label>
        <label>
          <span className="sr-only">資料の種類</span>
          <select
            aria-label="資料の種類"
            value={params.get('kind') ?? ''}
            onChange={(e) => update('kind', e.target.value)}
          >
            <option value="">すべての資料</option>
            {[
              ['poster', 'ポスター'],
              ['report', 'レポート'],
              ['thesis', '論文'],
              ['slide', 'スライド'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">並び順</span>
          <select
            aria-label="並び順"
            value={params.get('sort') ?? (q ? 'relevance' : 'newest')}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="relevance">一致するタイトルから</option>
            <option value="newest">新しい年度から</option>
          </select>
        </label>
        {awards && (
          <>
            <label>
              <span className="sr-only">賞</span>
              <select
                aria-label="賞"
                value={params.get('award') ?? ''}
                onChange={(e) => update('award', e.target.value)}
              >
                <option value="">すべての賞</option>
                {['大賞', '優秀賞', '奨励賞', '入賞'].map((s, i) => (
                  <option key={s} value={i + 1}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              賞名
              <input
                aria-label="賞名"
                defaultValue={params.get('awardName') ?? ''}
                key={params.get('awardName') ?? ''}
                maxLength={100}
                onBlur={(e) => update('awardName', e.target.value.trim())}
              />
            </label>
          </>
        )}
        {raw && (
          <button className={styles.clear} onClick={() => setParams({})}>
            <RotateCcw size={14} />
            条件をクリア
          </button>
        )}
      </div>
      {!awards && !raw && recommended.data?.items.length !== 0 && (
        <section aria-label="おすすめ">
          <h2>新しい年度から、出会う問い。</h2>
          {recommended.isError ? (
            <p role="status">おすすめを読み込めませんでした。</p>
          ) : (
            <div className={styles.workGrid}>
              {recommended.data?.items.map((w) => (
                <LiveWorkCard
                  key={w.documentID}
                  work={w}
                  from={location.pathname + location.search}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <section className={styles.results} aria-labelledby="live-results">
        <div className={styles.resultsHeader}>
          <h2 id="live-results">
            {q ? `「${q}」の検索結果` : awards ? '受賞した探究' : '作品を見つける'}
          </h2>
          <span role="status">{items.length}作品を表示</span>
        </div>
        {works.isPending ? (
          <p role="status">作品を探しています…</p>
        ) : works.isError ? (
          <div role="alert">
            <p>{failure(works.error)}</p>
            <button className="button secondary" onClick={() => void works.refetch()}>
              もう一度試す
            </button>
          </div>
        ) : (
          <>
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
                <p>キーワードを短くしたり、絞り込みを減らしてみてください。</p>
              </div>
            )}
            {works.hasNextPage && (
              <button
                className="button secondary"
                disabled={works.isFetchingNextPage}
                onClick={() => void works.fetchNextPage()}
              >
                {works.isFetchingNextPage ? '読み込み中…' : '続きを見る'}
              </button>
            )}
          </>
        )}
      </section>
      <section aria-label="検索履歴">
        <h2>最近の検索</h2>
        {historyError && <p role="alert">{historyError}</p>}
        {history.isError ? (
          <p role="status">検索履歴を読み込めませんでした。</p>
        ) : history.data?.items.length ? (
          <>
            <ul className="history-list">
              {history.data.items.map((h) => (
                <li key={h.id}>
                  <Link
                    to={`${new URLSearchParams(h.parameters).get('awardsOnly') === '1' ? '/awards' : '/explore'}?${h.parameters}`}
                  >
                    {new URLSearchParams(h.parameters).get('q') || '絞り込み条件で探す'}
                  </Link>
                  <button
                    aria-label={`${new URLSearchParams(h.parameters).get('q') || '条件'}の検索履歴を削除`}
                    onClick={() => void deleteHistory(h.id)}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
            {confirmClear ? (
              <div role="group" aria-label="履歴削除の確認">
                <p>自分の検索履歴をすべて削除しますか？</p>
                <button onClick={() => void deleteHistory()}>すべて削除する</button>
                <button onClick={() => setConfirmClear(false)}>キャンセル</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)}>検索履歴をすべて削除</button>
            )}
          </>
        ) : (
          <p>検索すると、ここからもう一度たどれます。</p>
        )}
      </section>
    </div>
  );
}
