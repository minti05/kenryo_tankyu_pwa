import type { QueryClient } from '@tanstack/react-query';
import type { SearchHistoryPageDto } from '../../contracts/discovery.generated';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import type { AuthState } from '../auth/context';
import { ApiError } from '../../lib/api-client';
export async function recordSearch(
  request: AuthState['request'],
  params: URLSearchParams,
  awards = false,
) {
  const next = new URLSearchParams(params);
  next.delete('cursor');
  next.delete('limit');
  if (awards) next.set('awardsOnly', '1');
  if (!next.size) return;
  return request<SearchHistoryPageDto>('/api/search-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters: next.toString() }),
  });
}
export function historyMessage(error: unknown) {
  return error instanceof ApiError && error.code === 'history_full'
    ? '検索履歴が上限に達しました。不要な履歴を削除すると保存できます。'
    : '検索結果は表示できますが、履歴を保存できませんでした。';
}
export const searchHistorySaveKey = (
  uid: string | undefined,
  params: URLSearchParams,
  awards: boolean,
) => {
  const normalized = new URLSearchParams(params);
  normalized.delete('cursor');
  normalized.delete('limit');
  normalized.sort();
  return ['search-history-save', uid, awards, normalized.toString()] as const;
};
export function recordSearchInBackground(
  query: QueryClient,
  uid: string | undefined,
  request: AuthState['request'],
  params: URLSearchParams,
  awards = false,
) {
  if (!uid) return;
  const key = searchHistorySaveKey(uid, params, awards);
  const attempt = crypto.randomUUID();
  query.setQueryData(key, { attempt, error: '' });
  void recordSearch(request, params, awards)
    .then((value) => {
      // Logout/account changes clear the cache; a late response must not repopulate it.
      if (query.getQueryData<{ attempt: string }>(key)?.attempt !== attempt) return;
      cacheSearchHistory(query, uid, value);
    })
    .catch((error) => {
      if (query.getQueryData<{ attempt: string }>(key)?.attempt === attempt)
        query.setQueryData(key, { attempt, error: historyMessage(error) });
    });
}
export function historyLabel(parameters: string) {
  const params = new URLSearchParams(parameters);
  const category = CATEGORY_CATALOG.find((c) => c.id === params.get('category'));
  const subcategory = category?.subcategories.find((s) => s.id === params.get('subcategory'));
  return (
    [
      params.get('q'),
      category?.label,
      subcategory?.label,
      params.get('awardsOnly') === '1' ? 'KRGP' : null,
    ]
      .filter(Boolean)
      .join(' · ') || '絞り込み条件で探す'
  );
}

export function cacheSearchHistory(
  query: QueryClient,
  uid: string | undefined,
  value: SearchHistoryPageDto | undefined,
) {
  if (!uid || !value) return;
  void query.cancelQueries({ queryKey: ['search-history', uid], exact: true });
  query.setQueryData(['search-history', uid], value);
}
