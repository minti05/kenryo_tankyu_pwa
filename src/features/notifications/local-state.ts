export interface NoticeIdentity {
  id: string;
  createdAt: string;
}
export interface InboxSnapshot {
  version: '1';
  asOf: string;
  items: NoticeIdentity[];
}
export interface LocalNoticeState {
  baseline: string | null;
  asOf: string | null;
  read: Record<string, string>;
  items: NoticeIdentity[];
}
const empty = (): LocalNoticeState => ({
  baseline: null,
  asOf: null,
  read: {},
  items: [],
});
let pending: Promise<IDBDatabase> | undefined;
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('tankyu-notice-state-v1');
channel?.addEventListener('message', () => listeners.forEach((fn) => fn()));
export function subscribeNoticeState(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function open() {
  return (pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('tankyu-notice-state-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('accounts');
    r.onerror = () => {
      pending = undefined;
      reject(r.error);
    };
    r.onblocked = () => {
      pending = undefined;
      reject(new Error('storage_blocked'));
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        pending = undefined;
      };
      resolve(r.result);
    };
  }));
}
async function state(
  uid: string,
  change?: (value: LocalNoticeState) => void,
): Promise<LocalNoticeState> {
  if (!uid) throw new Error('identity_required');
  const db = await open();
  const result = await new Promise<LocalNoticeState>((resolve, reject) => {
    const tx = db.transaction('accounts', change ? 'readwrite' : 'readonly');
    const store = tx.objectStore('accounts'),
      r = store.get(uid);
    let value: LocalNoticeState;
    r.onsuccess = () => {
      value = r.result ?? empty();
      if (change) {
        change(value);
        store.put(value, uid);
      }
    };
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(tx.error ?? new Error('storage_aborted'));
    tx.onerror = () => {};
  });
  if (change) {
    listeners.forEach((fn) => fn());
    channel?.postMessage('changed');
  }
  return result;
}
export const readNoticeState = (uid: string) => state(uid);
export function noticeIsRead(value: LocalNoticeState | undefined, notice: NoticeIdentity) {
  return (
    !value?.baseline ||
    Object.hasOwn(value.read, notice.id) ||
    (value.baseline !== null && Date.parse(notice.createdAt) <= Date.parse(value.baseline))
  );
}
function compact(value: LocalNoticeState) {
  if (value.asOf && value.items.every((n) => noticeIsRead(value, n))) value.baseline = value.asOf;
  if (value.baseline) {
    const cutoff = Date.parse(value.baseline);
    value.items = value.items.filter((n) => Date.parse(n.createdAt) > cutoff);
    value.read = Object.fromEntries(
      Object.entries(value.read).filter(([, at]) => Date.parse(at) > cutoff),
    );
  }
}
export function syncNoticeState(
  uid: string,
  snapshot: InboxSnapshot,
  requestedBaseline?: string | null,
) {
  if (
    !Number.isFinite(Date.parse(snapshot.asOf)) ||
    !Array.isArray(snapshot.items) ||
    snapshot.items.some(
      (n) => typeof n.id !== 'string' || !Number.isFinite(Date.parse(n.createdAt)),
    )
  )
    throw new Error('invalid_inbox');
  return state(uid, (value) => {
    // Another tab may have initialized this account while our first request was in flight.
    if (requestedBaseline === null && value.baseline !== null) return;
    if (value.asOf && Date.parse(snapshot.asOf) < Date.parse(value.asOf)) return;
    // The server timestamp is recorded only once on this account's first successful sync.
    // Old DB read flags and a device's possibly inaccurate wall clock are never used.
    value.baseline ??= snapshot.asOf;
    value.asOf = snapshot.asOf;
    value.items = snapshot.items.filter(
      (n) => Date.parse(n.createdAt) > Date.parse(value.baseline!),
    );
    compact(value);
  });
}
export function markNoticeRead(uid: string, notice: NoticeIdentity) {
  return state(uid, (value) => {
    value.read = { ...value.read, [notice.id]: notice.createdAt };
    compact(value);
  });
}
export function forgetNoticeState(uid: string) {
  return state(uid, (value) => {
    Object.assign(value, empty());
  });
}
