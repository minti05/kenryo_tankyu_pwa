import { useRef, useState, useId } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, RotateCcw } from 'lucide-react';
import type { FavoriteDto } from '../../contracts/library.generated';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import { useAuth } from '../auth/context';
import { ApiError } from '../../lib/api-client';
import { cacheFavorite } from './cache';
import { libraryMessage, retryableIntent } from './client';
type PendingFavorite = FavoriteDto & { attempt: string };
export function FavoriteButton({
  work,
  showCount = false,
}: {
  work: SearchWorkDto;
  showCount?: boolean;
}) {
  const { session, request, offline } = useAuth(),
    query = useQueryClient(),
    intent = useRef(retryableIntent());
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [failed, setFailed] = useState(false);
  const snapshot =
    work.favoriteCount !== undefined &&
    work.isFavorite !== undefined &&
    work.favoriteRevision !== undefined
      ? {
          version: '1' as const,
          favorite: work.isFavorite,
          count: work.favoriteCount,
          revision: work.favoriteRevision,
        }
      : null;
  const basis = `${work.documentID}:${snapshot?.favorite}:${snapshot?.count}:${snapshot?.revision}`;
  const [override, setOverride] = useState<{ basis: string; value: FavoriteDto } | null>(null);
  const state = useQuery({
    queryKey: ['favorite', session?.uid, work.documentID],
    enabled: !offline && !snapshot,
    queryFn: () => request<FavoriteDto>(`/api/works/${work.documentID}/state`),
    staleTime: 0,
  });
  const pendingKey = ['favorite-pending', session?.uid, work.documentID] as const;
  const pending = useQuery<PendingFavorite | null>({ queryKey: pendingKey, queryFn: skipToken });
  const confirmed = snapshot ? (override?.basis === basis ? override.value : snapshot) : state.data;
  const data = pending.data ?? confirmed;
  async function favorite() {
    if (!confirmed || busy || query.getQueryData(pendingKey)) return;
    const data = confirmed;
    const body = { favorite: !data.favorite, expectedRevision: data.revision };
    const attempt = crypto.randomUUID();
    setBusy(true);
    setMessage('');
    setFailed(false);
    query.setQueryData<PendingFavorite>(pendingKey, {
      ...data,
      favorite: body.favorite,
      count: Math.max(0, data.count + (body.favorite ? 1 : -1)),
      attempt,
    });
    try {
      const updated = await request<FavoriteDto>(`/api/favorites/${work.documentID}`, {
        method: 'PUT',
        body: JSON.stringify({ ...body, ...intent.current({ id: work.documentID, ...body }) }),
      });
      if (query.getQueryData<PendingFavorite>(pendingKey)?.attempt !== attempt) return;
      setOverride({ basis, value: updated });
      query.setQueryData(['favorite', session?.uid, work.documentID], updated);
      if (session) await cacheFavorite(query, session.uid, work, updated);
      intent.current.clear();
      setMessage(body.favorite ? 'お気に入りに追加しました。' : 'お気に入りから外しました。');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'favorite_conflict') {
        const fresh = await state.refetch();
        if (fresh.data) {
          setOverride({ basis, value: fresh.data });
          if (session) await cacheFavorite(query, session.uid, work, fresh.data);
        }
      }
      setFailed(true);
      setMessage(libraryMessage(e));
    } finally {
      if (query.getQueryData<PendingFavorite>(pendingKey)?.attempt === attempt)
        query.setQueryData(pendingKey, null);
      setBusy(false);
    }
  }
  const countId = useId();
  const label = data?.favorite ? 'お気に入りから外す' : 'お気に入りに追加';
  return (
    <div className="favorite-action">
      <button
        className={`work-icon-button favorite-button ${showCount ? 'with-count' : ''}`}
        aria-label={label}
        title={label}
        aria-describedby={showCount ? countId : undefined}
        aria-pressed={data?.favorite ?? false}
        disabled={busy || !!pending.data || offline || !data}
        aria-busy={busy || !!pending.data}
        onClick={() => void favorite()}
      >
        <Heart size={23} strokeWidth={1.7} fill={data?.favorite ? 'currentColor' : 'none'} />
        {showCount && (
          <span
            id={countId}
            className="favorite-count"
            aria-label={data ? `${data.count}件のいいね` : 'いいね数を確認できません'}
          >
            {data?.count ?? '—'}
          </span>
        )}
      </button>
      {state.isError && (
        <button
          className="work-icon-button"
          aria-label="お気に入りを読み直す"
          onClick={() => void state.refetch()}
        >
          <RotateCcw size={18} />
        </button>
      )}
      {message && (
        <p className={failed ? 'action-feedback' : 'sr-only'} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
