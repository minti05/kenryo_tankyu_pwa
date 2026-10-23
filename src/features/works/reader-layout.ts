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
