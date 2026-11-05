import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  FavoriteDto,
  LibraryPageDto,
  StatsDto,
  ViewRecordedDto,
} from '../../contracts/library.generated';
import { awardsQueryKey } from '../discovery/awards-cache';
import type { SearchPageDto, SearchWorkDto } from '../../contracts/discovery.generated';
type Pages = InfiniteData<LibraryPageDto, string>;

/** Patch all cached appearances without renewing publication metadata freshness. */
async function cacheFavoriteAppearances(
  query: QueryClient,
  uid: string,
  id: string,
  value: FavoriteDto,
) {
  const matches = (key: readonly unknown[]) =>
    key[1] === uid &&
    ['works', 'work', 'related', 'discovery', 'collection-works'].includes(String(key[0]));
  await query.cancelQueries({ predicate: (q) => matches(q.queryKey) });
  const updateWork = (work: SearchWorkDto): SearchWorkDto =>
    work.documentID === id
      ? {
          ...work,
          isFavorite: value.favorite,
          favoriteCount: value.count,
          favoriteRevision: value.revision,
        }
      : work;
  type CardPage = { items: (SearchWorkDto | { work: SearchWorkDto })[] };
  const updatePage = (page: CardPage) => ({
    ...page,
    items: page.items.map((item) =>
      'work' in item ? { ...item, work: updateWork(item.work) } : updateWork(item),
    ),
  });
  for (const [key, data] of query.getQueriesData<unknown>({
    predicate: (q) => matches(q.queryKey),
  })) {
    if (!data || typeof data !== 'object') continue;
    const updatedAt = query.getQueryState(key)?.dataUpdatedAt;
    let updated: unknown;
    if ('pages' in data && Array.isArray(data.pages)) {
      updated = { ...data, pages: data.pages.map(updatePage) };
    } else if ('items' in data && Array.isArray(data.items)) {
      updated = updatePage(data as CardPage);
    } else if ('work' in data) {
      updated = { ...data, work: updateWork(data.work as SearchWorkDto) };
    } else continue;
    query.setQueryData(key, updated, updatedAt === undefined ? undefined : { updatedAt });
  }
}
export const libraryStatsKey = (uid: string | undefined) => ['library-stats', uid] as const;
export function cacheLibraryStats(query: QueryClient, uid: string, stats?: StatsDto) {
  if (!stats) return;
  query.setQueryData<StatsDto>(libraryStatsKey(uid), (previous) =>
    previous && Date.parse(previous.serverTime) > Date.parse(stats.serverTime) ? previous : stats,
  );
}
function change(query: QueryClient, uid: string, update: (data: Pages, kind: string) => Pages) {
  for (const [key, data] of query.getQueriesData<Pages>({ queryKey: ['library', uid] })) {
    if (!data?.pages.length) continue;
    // Local edits do not extend freshness of other cards' publication metadata.
    const updatedAt = query.getQueryState(key)?.dataUpdatedAt;
    query.setQueryData(
      key,
      update(data, String(key[2])),
      updatedAt === undefined ? undefined : { updatedAt },
    );
  }
}
export async function cacheView(query: QueryClient, uid: string, result: ViewRecordedDto) {
  await query.cancelQueries({ queryKey: ['library', uid] });
  cacheLibraryStats(query, uid, result.stats);
  const item = result.item;
  if (!item) return;
  change(query, uid, (data, kind) => ({
    ...data,
    pages: data.pages.map((page, index) => {
      const items =
        kind === 'history'
          ? page.items.filter((i) => i.work.documentID !== item.work.documentID)
          : page.items.map((i) => (i.work.documentID === item.work.documentID ? item : i));
      if (kind === 'history' && index === 0) items.unshift(item);
      return { ...page, items, ...(index === 0 && result.stats ? { stats: result.stats } : {}) };
    }),
  }));
}
export async function cacheFavorite(
  query: QueryClient,
  uid: string,
  work: SearchWorkDto,
  value: FavoriteDto,
) {
  await cacheFavoriteAppearances(query, uid, work.documentID, value);
  await query.cancelQueries({ queryKey: ['library', uid] });
  const krgpKey = awardsQueryKey(uid);
  await query.cancelQueries({ queryKey: krgpKey, exact: true });
  const collection = query.getQueryData<SearchPageDto>(krgpKey);
  if (collection) {
    const updatedAt = query.getQueryState(krgpKey)?.dataUpdatedAt;
    query.setQueryData(
      krgpKey,
      {
        ...collection,
        items: collection.items.map((item) =>
          item.documentID === work.documentID
            ? {
                ...item,
                favoriteCount: value.count,
                isFavorite: value.favorite,
                favoriteRevision: value.revision,
              }
            : item,
        ),
      },
      updatedAt === undefined ? undefined : { updatedAt },
    );
  }
  const updated = {
    ...work,
    favoriteCount: value.count,
    isFavorite: value.favorite,
    favoriteRevision: value.revision,
  };
  change(query, uid, (data, kind) => {
    const present = data.pages.some((p) =>
      p.items.some((i) => i.work.documentID === work.documentID),
    );
    return {
      ...data,
      pages: data.pages.map((page, index) => ({
        ...page,
        items: [
          ...(kind === 'favorites' && value.favorite && !present && index === 0
            ? [{ work: updated, viewedAt: null, favorite: true }]
            : []),
          ...page.items
            .filter(
              (i) =>
                kind !== 'favorites' || value.favorite || i.work.documentID !== work.documentID,
            )
            .map((i) =>
              i.work.documentID === work.documentID
                ? { ...i, work: updated, favorite: value.favorite }
                : i,
            ),
        ],
      })),
    };
  });
}
export async function cacheHistoryDelete(
  query: QueryClient,
  uid: string,
  id: string | undefined,
  body: Record<string, unknown>,
  stats?: StatsDto,
) {
  await query.cancelQueries({ queryKey: ['library', uid] });
  cacheLibraryStats(query, uid, stats);
  change(query, uid, (data, kind) => ({
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: page.items.flatMap((item) => {
        if (id) return item.work.documentID === id ? [] : [item];
        const at = Date.parse(item.viewedAt ?? '');
        const removed =
          body.scope === 'all' ||
          (at >= Date.parse(String(body.from)) && at < Date.parse(String(body.to)));
        if (!removed) return [item];
        return kind === 'history' ? [] : [{ ...item, viewedAt: null }];
      }),
      ...(index === 0 && stats ? { stats } : {}),
    })),
  }));
  if (id) query.removeQueries({ queryKey: ['favorite', uid, id], exact: true });
}
