import { useEffect } from 'react';
import { useAuth } from '../features/auth/context';
import { preparePdfAssets } from '../features/offline/assets';

// Store public SDK files on disk, without loading JS, creating workers or opening PDFs.
export function PdfPreparation() {
  const { session, offline } = useAuth();
  const signedIn = !!session;
  useEffect(() => {
    const display = matchMedia('(display-mode: standalone)');
    let disposed = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const installed = () =>
      display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const run = () => {
      if (
        disposed ||
        started ||
        !navigator.onLine ||
        offline ||
        document.visibilityState !== 'visible' ||
        connection?.saveData ||
        ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
      )
        return;
      started = true;
      void preparePdfAssets({ background: true }).catch(() => {
        started = false;
      });
    };
    const schedule = (wasInstalled = false) => {
      if (disposed || started || (!signedIn && !installed() && !wasInstalled)) return;
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if ('requestIdleCallback' in window)
        idle = window.requestIdleCallback(run, { timeout: 5000 });
      else timer = setTimeout(run, 1200);
    };
    const resume = () => schedule();
    const install = () => schedule(true);
    schedule();
    window.addEventListener('online', resume);
    window.addEventListener('appinstalled', install);
    document.addEventListener('visibilitychange', resume);
    display.addEventListener('change', resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.removeEventListener('online', resume);
      window.removeEventListener('appinstalled', install);
      document.removeEventListener('visibilitychange', resume);
      display.removeEventListener('change', resume);
    };
  }, [signedIn, offline]);
  return null;
}
