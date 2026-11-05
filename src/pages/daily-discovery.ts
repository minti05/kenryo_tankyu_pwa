import { useEffect, useState } from 'react';
const offset = 9 * 60 * 60 * 1000;
export function discoveryDay(now = Date.now()) {
  return new Date(now + offset).toISOString().slice(0, 10);
}
export function nextDiscoveryDay(now = Date.now()) {
  return Math.floor((now + offset) / 86400000) * 86400000 + 86400000 - offset;
}
export function useDiscoveryDay() {
  const [day, setDay] = useState(discoveryDay);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      setDay(discoveryDay());
      timer = setTimeout(refresh, Math.max(1000, nextDiscoveryDay() - Date.now()));
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return day;
}
