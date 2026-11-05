import { useEffect } from 'react';
import { useAuth } from '../features/auth/context';
import { syncReadingTips } from '../lib/reading-tips';

export function ReadingTipsSync() {
  const { session, offline, request } = useAuth();
  useEffect(() => {
    if (!session || session.role === 'unassigned' || offline || navigator.onLine === false) return;
    const timer = setTimeout(() => {
      void syncReadingTips(request);
    }, 0);
    return () => clearTimeout(timer);
  }, [session, offline, request]);
  return null;
}
