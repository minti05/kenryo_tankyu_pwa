import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { useAuth } from '../auth/context';
import { libraryMessage, retryableIntent } from './client';
export interface Collection {
  id: string;
  uid: string;
  name: string;
  count: number;
  revision: number;
  saved?: boolean;
}
export interface CollectionList {
  items: Collection[];
}
export function useCollections(documentID?: string) {
  const { session, request, offline } = useAuth();
  return useQuery({
    queryKey: ['collections', session?.uid, documentID ?? 'list'],
    enabled: !!session && !offline,
    queryFn: async ({ signal }) => {
      const result = await request<CollectionList>(
        '/api/collections' + (documentID ? '?documentID=' + documentID : ''),
        { signal },
      );
      if (!Array.isArray(result.items)) throw new ApiError(503, 'library_unavailable');
      return result;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}
export function useCollectionMutation() {
  const { session, request } = useAuth();
  const query = useQueryClient(),
    intent = useRef(retryableIntent()),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function mutate(
    path: string,
    method: string,
    body: Record<string, unknown>,
    documentID?: string,
  ) {
    if (lock.current || !session) return false;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await request<Collection & { deleted?: boolean }>(path, {
        method,
        body: JSON.stringify({ ...body, ...intent.current({ path, method, body }) }),
      });
      intent.current.clear();
      await query.cancelQueries({ queryKey: ['collections', session.uid] });
      for (const [key, data] of query.getQueriesData<CollectionList>({
        queryKey: ['collections', session.uid],
      })) {
        if (!data) continue;
        const items = result.deleted
          ? data.items.filter((c) => c.id !== result.id)
          : [...data.items];
        if (!result.deleted) {
          const previous = data.items.find((c) => c.id === result.id);
          const updated = {
            ...result,
            saved:
              documentID && key[2] === documentID
                ? (result.saved ?? false)
                : (previous?.saved ?? false),
          };
          const index = items.findIndex((c) => c.id === result.id);
          if (index < 0) items.unshift(updated);
          else items[index] = updated;
        }
        // A mutation updates one collection, not the freshness of all other rows.
        query.setQueryData(
          key,
          { items },
          { updatedAt: query.getQueryState(key)?.dataUpdatedAt ?? Date.now() },
        );
      }
      await query.invalidateQueries({ queryKey: ['collection-works', session.uid, result.id] });
      return true;
    } catch (error) {
      setMessage(libraryMessage(error));
      await query.invalidateQueries({ queryKey: ['collections', session.uid] });
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { mutate, busy, message };
}
