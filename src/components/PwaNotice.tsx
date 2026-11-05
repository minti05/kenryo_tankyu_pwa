import { useEffect, useSyncExternalStore } from 'react';
import { applyUpdate, startUpdates, subscribeUpdates, updateSnapshot } from '../lib/pwa-updates';
import { UpdateDialog } from './UpdateDialog';
export function PwaNotice() {
  const needed = useSyncExternalStore(subscribeUpdates, updateSnapshot, () => false);
  useEffect(() => {
    void startUpdates();
  }, []);
  return needed ? <UpdateDialog onUpdate={applyUpdate} /> : null;
}
