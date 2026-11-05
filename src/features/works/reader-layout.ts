import { useSyncExternalStore } from 'react';
const query = '(min-width: 1200px), (min-width: 900px) and (orientation: landscape)';
const subscribe = (notify: () => void) => {
  const media = matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useDesktopReader() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}

const wideQuery = '(min-width: 1440px) and (orientation: landscape)';
export function useWideReader() {
  return useSyncExternalStore(
    (notify) => {
      const m = matchMedia(wideQuery);
      m.addEventListener('change', notify);
      return () => m.removeEventListener('change', notify);
    },
    () => matchMedia(wideQuery).matches,
    () => false,
  );
}
