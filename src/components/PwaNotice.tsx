import { useRegisterSW } from 'virtual:pwa-register/react';
export function PwaNotice() {
  const {
    needRefresh: [needed, setNeeded],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needed) return null;
  return (
    <aside className="update-notice" role="status">
      <p>新しい画面を利用できます。</p>
      <button className="button primary" onClick={() => void updateServiceWorker(true)}>
        更新する
      </button>
      <button className="button quiet" onClick={() => setNeeded(false)}>
        あとで
      </button>
    </aside>
  );
}
