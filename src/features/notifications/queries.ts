import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/context';
import {
  readNoticeState,
  subscribeNoticeState,
  syncNoticeState,
  type InboxSnapshot,
} from './local-state';

export function useLocalNoticeState() {
  const { session } = useAuth(),
    client = useQueryClient(),
    uid = session?.uid;
  const local = useQuery({
    queryKey: ['notification-state', uid],
    queryFn: () => readNoticeState(uid!),
    enabled: !!uid,
    networkMode: 'always',
    staleTime: Infinity,
  });
  useEffect(
    () =>
      subscribeNoticeState(() => {
        void client.invalidateQueries({
          queryKey: ['notification-state', uid],
          exact: true,
        });
      }),
    [client, uid],
  );
  return local;
}

export function useNoticeInbox() {
  const { session, offline, request } = useAuth(),
    uid = session?.uid;
  const previousOffline = useRef(offline);
  const query = useQuery({
    queryKey: ['notifications', 'inbox', uid],
    queryFn: async () => {
      const local = await readNoticeState(uid!);
      const suffix = local.baseline ? '?since=' + encodeURIComponent(local.baseline) : '';
      const snapshot = await request<InboxSnapshot>('/api/notifications/inbox' + suffix);
      return syncNoticeState(uid!, snapshot, local.baseline);
    },
    enabled: !!uid && !offline,
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const { refetch } = query;
  useEffect(() => {
    if (previousOffline.current && !offline && uid) void refetch();
    previousOffline.current = offline;
  }, [offline, uid, refetch]);
  return query;
}
