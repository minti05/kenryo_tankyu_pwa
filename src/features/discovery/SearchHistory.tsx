import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, X } from 'lucide-react';
import { useAuth } from '../auth/context';
import type { SearchHistoryPageDto } from '../../contracts/discovery.generated';
import { cacheSearchHistory } from './search-history';
import { historyLabel } from './search-history';
import './discovery.css';
export function SearchHistory({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { session, request, offline } = useAuth(),
    query = useQueryClient();
  const [error, setError] = useState(''),
    [confirmClear, setConfirmClear] = useState(false);
  const history = useQuery({
    queryKey: ['search-history', session?.uid],
    enabled: !!session && !offline,
    queryFn: ({ signal }) => request<SearchHistoryPageDto>('/api/search-history', { signal }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
  });
  async function remove(id?: string) {
    try {
      const updated = await request<SearchHistoryPageDto>(
        `/api/search-history${id ? '?id=' + encodeURIComponent(id) : ''}`,
        {
          method: 'DELETE',
        },
      );
      cacheSearchHistory(query, session?.uid, updated);
      setError('');
      setConfirmClear(false);
    } catch {
      setError('履歴を削除できませんでした。もう一度お試しください。');
    }
  }
  return (
    <section
      className={compact ? 'search-history compact-history' : 'search-history'}
      aria-label="検索履歴"
    >
      <div className="history-heading">
        <h2>
          <History size={20} />
          最近の検索
        </h2>
        {!!history.data?.items.length && (
          <button className="button quiet" onClick={() => setConfirmClear(true)}>
            すべて削除
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {confirmClear && (
        <div className="history-confirm" role="group" aria-label="履歴削除の確認">
          <p>自分の検索履歴をすべて削除しますか？</p>
          <button className="button secondary" onClick={() => void remove()}>
            すべて削除する
          </button>
          <button className="button quiet" onClick={() => setConfirmClear(false)}>
            キャンセル
          </button>
        </div>
      )}
      {offline ? (
        <p>検索履歴はオンラインで確認できます。</p>
      ) : history.isPending ? (
        <p role="status">検索履歴を読み込んでいます…</p>
      ) : history.isError ? (
        <div role="status">
          <p>検索履歴を読み込めませんでした。</p>
          <button className="button quiet" onClick={() => void history.refetch()}>
            再試行
          </button>
        </div>
      ) : history.data?.items.length ? (
        <ul className="history-list">
          {history.data.items.map((h) => (
            <li key={h.id}>
              <Link
                onClick={onNavigate}
                to={`${new URLSearchParams(h.parameters).get('awardsOnly') === '1' ? '/awards' : '/results'}?${h.parameters}`}
              >
                <History size={18} />
                <span>{historyLabel(h.parameters)}</span>
              </Link>
              <button
                aria-label={`${historyLabel(h.parameters)}の検索履歴を削除`}
                onClick={() => void remove(h.id)}
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>検索すると、ここからもう一度たどれます。</p>
      )}
    </section>
  );
}
