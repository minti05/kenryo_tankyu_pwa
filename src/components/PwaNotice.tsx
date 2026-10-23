import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdateDialog } from './UpdateDialog';
export function PwaNotice() {
  const {
    needRefresh: [needed],
    updateServiceWorker,
  } = useRegisterSW();
  return needed ? <UpdateDialog onUpdate={() => updateServiceWorker(true)} /> : null;
}
