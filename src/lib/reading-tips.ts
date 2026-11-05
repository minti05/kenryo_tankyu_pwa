import {
  DEFAULT_READING_TIPS,
  validReadingTips,
  type ReadingTipsDto,
} from '../contracts/reading-tips.generated';

const CACHE_KEY = 'archive-reading-tips-v1';
const ATTEMPT_KEY = 'archive-reading-tips-checked-v1';
const DAY = 24 * 60 * 60 * 1000;
let memory: ReadingTipsDto | null = null;
let attemptedAt = 0;
let inFlight: Promise<void> | null = null;

export function localReadingTips(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (validReadingTips(saved)) memory = saved;
  } catch {
    /* Storage is optional, including in private browsing. */
  }
  return (memory?.tips ?? DEFAULT_READING_TIPS).slice();
}

/** Never called by the PDF loader; at most one background attempt per day. */
export function syncReadingTips(
  request: <T>(path: string, options?: RequestInit) => Promise<T>,
): Promise<void> {
  if (inFlight) return inFlight;
  const sync = async () => {
    let last = attemptedAt;
    try {
      last = Math.max(last, Number(localStorage.getItem(ATTEMPT_KEY)) || 0);
    } catch {
      /* Optional. */
    }
    const now = Date.now();
    if (last > 0 && now >= last && now - last < DAY) return;
    // Record failed attempts too, so offline/errors never cause repeated polling.
    attemptedAt = now;
    try {
      localStorage.setItem(ATTEMPT_KEY, String(now));
    } catch {
      /* Optional. */
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const data = await request<unknown>('/api/reading-tips', { signal: controller.signal });
      if (!validReadingTips(data)) return;
      memory = data;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        /* Keep the in-memory copy. */
      }
    } catch {
      /* Always retain the last working tips or bundled defaults. */
    } finally {
      clearTimeout(timer);
    }
  };
  inFlight = (
    navigator.locks ? navigator.locks.request('archive-reading-tips-sync', sync) : sync()
  ).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
