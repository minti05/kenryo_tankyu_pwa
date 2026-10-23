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
  change(query, uid, (data, kind) => ({
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: page.items.filter((i) => {
        if (id) return i.work.documentID !== id;
        if (kind !== 'history') return true;
        if (body.scope === 'all') return false;
        const at = Date.parse(i.viewedAt ?? '');
        return !(at >= Date.parse(String(body.from)) && at < Date.parse(String(body.to)));
      }),
      ...(index === 0 && stats ? { stats } : {}),
    })),
  }));
  if (id) query.removeQueries({ queryKey: ['favorite', uid, id], exact: true });
}
