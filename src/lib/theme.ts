import { useSyncExternalStore } from 'react';
type Theme = 'light' | 'dark';
const key = 'archive-theme',
  event = 'archive-theme-change';
function stored(): Theme | null {
  try {
    const value = localStorage.getItem(key);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}
const system = matchMedia('(prefers-color-scheme: dark)');
let preference = stored();
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(event));
}
apply(preference ?? (system.matches ? 'dark' : 'light'));
system.addEventListener('change', (e) => {
  if (!preference) apply(e.matches ? 'dark' : 'light');
});
window.addEventListener('storage', (e) => {
  if (e.key === key || e.key === null) {
    preference = stored();
    apply(preference ?? (system.matches ? 'dark' : 'light'));
  }
});
function subscribe(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}
function snapshot() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, snapshot);
  return {
    theme,
    setTheme: (next: Theme) => {
      preference = next;
      try {
        localStorage.setItem(key, next);
      } catch {
        /* Keep this page usable when storage is disabled. */
      }
      apply(next);
    },
  };
}
