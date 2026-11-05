import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

function positionKey(uid: string | undefined, endpoint: string, params: URLSearchParams) {
  const normalized = new URLSearchParams(params);
  normalized.delete('cursor');
  normalized.sort();
  return `results-position:${uid}:${endpoint}:${normalized}`;
}
export function clearResultsPosition(
  uid: string | undefined,
  endpoint: string,
  params: URLSearchParams,
) {
  try {
    sessionStorage.removeItem(positionKey(uid, endpoint, params));
  } catch {
    /* optional */
  }
}
function readPosition(key: string) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      value &&
      Number.isFinite(value.top) &&
      value.top >= 0 &&
      Number.isInteger(value.pages) &&
      value.pages >= 1 &&
      value.pages <= 100 &&
      Number.isFinite(value.at) &&
      Date.now() - value.at >= 0 &&
      Date.now() - value.at < 30 * 60_000
    )
      return value as { top: number; pages: number; at: number };
  } catch {
    /* optional */
  }
  return { top: 0, pages: 1, at: Date.now() };
}
interface ResultsState {
  data?: { pages: unknown[] } | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}
/** Store only position/page count. Protected result data is fetched again after a reload. */
export function useResultsPosition(
  uid: string | undefined,
  endpoint: string,
  params: URLSearchParams,
  result: ResultsState,
) {
  const { isPending, isFetching, isError, hasNextPage, fetchNextPage } = result;
  const key = positionKey(uid, endpoint, params);
  const saved = useMemo(() => readPosition(key), [key]);
  const restored = useRef('');
  const pageCount = result.data?.pages.length ?? 0;
  const latest = useRef({ key, pageCount });
  useLayoutEffect(() => {
    latest.current = { key, pageCount };
  }, [key, pageCount]);
  useLayoutEffect(() => {
    const persist = () => {
      if (!uid || restored.current !== key || latest.current.key !== key) return;
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            top: window.scrollY,
            pages: Math.max(1, latest.current.pageCount),
            at: Date.now(),
          }),
        );
      } catch {
        /* optional */
      }
    };
    window.addEventListener('scroll', persist, { passive: true });
    window.addEventListener('pagehide', persist);
    return () => {
      persist();
      window.removeEventListener('scroll', persist);
      window.removeEventListener('pagehide', persist);
    };
  }, [key, uid]);
  useEffect(() => {
    if (restored.current === key || isPending || isFetching || !pageCount) return;
    if (pageCount < saved.pages && hasNextPage && !isError) {
      void fetchNextPage();
      return;
    }
    restored.current = key;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        window.scrollTo({ top: saved.top, behavior: 'instant' }),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [key, saved, pageCount, isPending, isFetching, isError, hasNextPage, fetchNextPage]);
}
