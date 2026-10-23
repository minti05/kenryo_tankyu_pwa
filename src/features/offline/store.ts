import { unsubscribeBrowserPush } from '../../lib/push-cleanup';
import type { SearchWorkDto } from '../../contracts/discovery.generated';
import type { Session } from '../auth/context';
import type { PdfData } from '../works/pdf-data';
export const TTL = 72 * 60 * 60 * 1000;
export const LIMIT = 100 * 1024 * 1024;
const DB = 'tankyu-offline-v1',
  FENCE = 'tankyu-offline-fence';
export interface CacheSession {
  uid: string;
  epoch: string;
  fence: string;
}
export interface PushBinding {
  deviceId: string;
  binding: string;
  active: boolean;
  expiresAt: number;
}
interface Control extends CacheSession {
  push?: PushBinding;
  streak?: { day: number; count: number };
  grant: (Session & { expiresAt: number }) | null;
  server: number;
  wall: number;
  lastWall: number;
  lastServer: number;
  blocked: boolean;
}
export interface SavedPdf {
  key: string;
  uid: string;
  id: string;
  kind: string;
  revision: string;
  sha256: string;
  bytes: number;
  onlineViewedAt: number;
  expiresAt: number;
  work: SearchWorkDto;
}
export interface CachedPdf extends SavedPdf {
  blob: Blob;
}
let anchor: { mono: number; server: number } | null = null;
let current: Control | null = null;
let pending: Promise<IDBDatabase> | undefined;
const listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tankyu-offline-v1') : null;
function emit(remote = false) {
  listeners.forEach((fn) => fn());
  if (!remote) channel?.postMessage('changed');
}
channel?.addEventListener('message', () => {
  current = null;
  emit(true);
});
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key === FENCE) {
      current = null;
      emit(true);
    }
  });
export function subscribeCache(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function fence() {
  let f = localStorage.getItem(FENCE);
  if (!f) {
    f = crypto.randomUUID();
    localStorage.setItem(FENCE, f);
  }
  return f;
}
function open() {
  return (pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('control');
      r.result.createObjectStore('entries', { keyPath: 'key' });
      r.result.createObjectStore('files');
    };
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
function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transaction<T>(fn: (tx: IDBTransaction) => Promise<T>) {
  const db = await open(),
    tx = db.transaction(['control', 'entries', 'files'], 'readwrite');
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('storage_aborted'));
    tx.onerror = () => {};
  });
  try {
    const value = await fn(tx);
    await done;
    return value;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    await done.catch(() => {});
    throw e;
  }
}
const control = (tx: IDBTransaction) =>
  request<Control | undefined>(tx.objectStore('control').get('owner'));
const entries = (tx: IDBTransaction) => request<SavedPdf[]>(tx.objectStore('entries').getAll());
function drop(tx: IDBTransaction, rows: SavedPdf[]) {
  for (const row of rows) {
    tx.objectStore('entries').delete(row.key);
    tx.objectStore('files').delete(row.key);
  }
}
function same(c: Control | undefined, s: CacheSession) {
  return c && c.uid === s.uid && c.epoch === s.epoch && c.fence === s.fence && s.fence === fence();
}
function tick(c: Control) {
  const wall = Date.now();
  if (wall < c.lastWall - 60_000 || wall < c.wall - 60_000) c.blocked = true;
  const estimate = c.server ? c.server + Math.max(0, wall - c.wall) : wall;
  if (!anchor) anchor = { mono: performance.now(), server: Math.max(estimate, c.lastServer) };
  const now = Math.max(
    estimate,
    c.lastServer,
    anchor.server + Math.max(0, performance.now() - anchor.mono),
  );
  c.lastWall = Math.max(c.lastWall, wall);
  c.lastServer = now;
  current = c;
  return now;
}
async function checked(tx: IDBTransaction, s?: CacheSession) {
  const c = await control(tx);
  if (!c || (s && !same(c, s))) throw new Error('offline_identity_changed');
  const now = tick(c),
    rows = await entries(tx);
  drop(
    tx,
    rows.filter((r) => c.blocked || r.uid !== c.uid || r.expiresAt <= now),
  );
  if (c.blocked) c.grant = null;
  tx.objectStore('control').put(c, 'owner');
  return { c, now, rows: rows.filter((r) => !c.blocked && r.uid === c.uid && r.expiresAt > now) };
}
export async function activateCache(uid: string): Promise<CacheSession> {
  const result = await transaction(async (tx) => {
    let c = await control(tx);
    const f = fence();
    if (!c || c.uid !== uid || c.fence !== f) {
      tx.objectStore('entries').clear();
      tx.objectStore('files').clear();
      c = {
        uid,
        epoch: crypto.randomUUID(),
        fence: f,
        grant: null,
        server: 0,
        wall: Date.now(),
        lastWall: Date.now(),
        lastServer: 0,
        blocked: false,
      };
      anchor = null;
      tx.objectStore('control').put(c, 'owner');
    }
    current = c;
    return { uid: c.uid, epoch: c.epoch, fence: c.fence };
  });
  emit();
  return result;
}
/** Synchronous fence first: even a failed IDB deletion cannot resurrect old access. */
export async function revokeCache() {
  current = null;
  anchor = null;
  localStorage.setItem(FENCE, crypto.randomUUID());
  emit();
  const hadPush = await transaction(async (tx) => {
    const c = await control(tx);
    tx.objectStore('entries').clear();
    tx.objectStore('files').clear();
    tx.objectStore('control').clear();
    return !!c?.push;
  });
  // The local fence already blocks display; OS cleanup must not delay revocation UI.
  if (hadPush) void unsubscribeBrowserPush().catch(() => {});
  emit();
}
export async function forgetOtherUser(uid: string) {
  const different = await transaction(async (tx) => {
    const c = await control(tx);
    return !!c && c.uid !== uid;
  });
  if (different) await revokeCache();
}
export async function resumeCache(uid: string) {
  return transaction(async (tx) => {
    const c = await control(tx);
    if (!c || c.uid !== uid || c.fence !== fence()) return null;
    const result = await checked(tx, c);
    if (!result.c.grant || result.c.blocked || result.c.grant.expiresAt <= result.now) return null;
    return {
      session: {
        version: '1' as const,
        uid,
        role: result.c.grant.role,
        ...(result.c.grant.enterYear === undefined ? {} : { enterYear: result.c.grant.enterYear }),
      },
      cacheSession: { uid, epoch: c.epoch, fence: c.fence },
    };
  });
}
export function cacheTime() {
  return current ? tick(current) : Date.now();
}
export async function cacheIsCurrent(s: CacheSession) {
  return transaction(async (tx) => !!same(await control(tx), s));
}
export async function listSaved(s: CacheSession) {
  return transaction(async (tx) =>
    (await checked(tx, s)).rows.sort((a, b) => b.onlineViewedAt - a.onlineViewedAt),
  );
}
export function usable(s: CacheSession, row: SavedPdf) {
  try {
    return (
      !!current &&
      !!same(current, s) &&
      !current.blocked &&
      row.uid === s.uid &&
      row.expiresAt > tick(current)
    );
  } catch {
    return false;
  }
}
export async function readSaved(
  s: CacheSession,
  id: string,
  kind: string,
  revision?: string,
): Promise<CachedPdf | null> {
  const result = await transaction(async (tx) => {
    const { c, rows } = await checked(tx, s);
    if (c.blocked) return null;
    const row = rows.find(
      (r) => r.id === id && r.kind === kind && (!revision || r.revision === revision),
    );
    if (!row) return null;
    const bytes = await request<ArrayBuffer | undefined>(tx.objectStore('files').get(row.key));
    if (!(bytes instanceof ArrayBuffer)) {
      drop(tx, [row]);
      return null;
    }
    return { ...row, blob: new Blob([bytes], { type: 'application/pdf' }) };
  });
  if (!result) return null;
  const hash = [
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', await result.blob.arrayBuffer())),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (result.blob.size !== result.bytes || hash !== result.sha256 || !usable(s, result)) {
    await deleteSaved(s, result.id, result.kind);
    return null;
  }
  return result;
}
export async function saveViewed(
  s: CacheSession,
  session: Session,
  work: SearchWorkDto,
  kind: string,
  data: PdfData,
) {
  const at = Date.parse(data.authorizedAt);
  if (
    session.uid !== s.uid ||
    !Number.isFinite(at) ||
    data.blob.size < 5 ||
    data.blob.size > 3_000_000 ||
    !/^[a-f0-9]{64}$/.test(data.revision) ||
    !/^[a-f0-9]{64}$/.test(data.sha256)
  )
    throw new Error('invalid_offline_pdf');
  const binary = await data.blob.arrayBuffer();
  const row: SavedPdf = {
    key: JSON.stringify([s.uid, work.documentID, kind, data.revision]),
    uid: s.uid,
    id: work.documentID,
    kind,
    revision: data.revision,
    sha256: data.sha256,
    bytes: data.blob.size,
    onlineViewedAt: at,
    expiresAt: at + TTL,
    work,
  };
  const write = () =>
    transaction(async (tx) => {
      const c = await control(tx);
      if (!same(c, s)) throw new Error('offline_identity_changed');
      // Fresh authenticated server time can repair a bad local clock; old future rows are discarded.
      const rows = await entries(tx),
        remove = rows.filter(
          (r) =>
            r.uid !== s.uid ||
            r.expiresAt <= at ||
            r.onlineViewedAt > at ||
            (r.id === row.id && r.kind === kind),
        );
      let total = rows.filter((r) => !remove.includes(r)).reduce((n, r) => n + r.bytes, 0);
      const oldest = rows
        .filter((r) => !remove.includes(r))
        .sort((a, b) => a.onlineViewedAt - b.onlineViewedAt);
      while (total + row.bytes > LIMIT && oldest.length) {
        const r = oldest.shift()!;
        remove.push(r);
        total -= r.bytes;
      }
      drop(tx, remove);
      const next: Control = {
        ...c!,
        grant: { ...session, expiresAt: row.expiresAt },
        server: at + Math.max(0, performance.now() - data.receivedMono),
        wall: Date.now(),
        lastWall: Date.now(),
        lastServer: at + Math.max(0, performance.now() - data.receivedMono),
        blocked: false,
      };
      tx.objectStore('control').put(next, 'owner');
      tx.objectStore('entries').put(row);
      tx.objectStore('files').put(binary, row.key);
      current = next;
      anchor = { mono: performance.now(), server: next.server };
    });
  try {
    await write();
  } catch (e) {
    if (!(e instanceof DOMException) || e.name !== 'QuotaExceededError') throw e;
    await transaction(async (tx) => {
      if (!same(await control(tx), s)) throw new Error('offline_identity_changed');
      const rows = (await entries(tx)).sort((a, b) => a.onlineViewedAt - b.onlineViewedAt);
      if (rows[0]) drop(tx, [rows[0]]);
    });
    await write();
  }
  emit();
  return row;
}
export async function deleteSaved(
  s: CacheSession,
  id?: string,
  kind?: string,
  range?: { from: number; to: number },
) {
  await transaction(async (tx) => {
    if (!same(await control(tx), s)) throw new Error('offline_identity_changed');
    drop(
      tx,
      (await entries(tx)).filter(
        (r) =>
          r.uid === s.uid &&
          (!id || r.id === id) &&
          (!kind || r.kind === kind) &&
          (!range || (r.onlineViewedAt >= range.from && r.onlineViewedAt < range.to)),
      ),
    );
  });
  emit();
}
/** Safe from a SW too: never serves protected bytes or invents an identity. */
export async function sweepExpired() {
  await transaction(async (tx) => {
    const c = await control(tx);
    if (!c) return;
    const now = tick(c);
    drop(
      tx,
      (await entries(tx)).filter((r) => c.blocked || r.expiresAt <= now),
    );
    if (c.blocked) c.grant = null;
    tx.objectStore('control').put(c, 'owner');
  });
}

/** Local, owner-fenced usage streak. Legacy device-global SharedPreferences cannot be transferred. */
export async function visitStreak(session: CacheSession, serverTime: string): Promise<number> {
  const millis = Date.parse(serverTime);
  if (!Number.isFinite(millis)) throw new Error('invalid_server_time');
  return transaction(async (tx) => {
    const { c } = await checked(tx, session);
    const day = Math.floor((millis + 9 * 3600000) / 86400000);
    const old = c.streak;
    if (!old || day > old.day)
      c.streak = { day, count: old && day === old.day + 1 ? old.count + 1 : 1 };
    tx.objectStore('control').put(c, 'owner');
    return c.streak?.count ?? 1;
  });
}

export async function readPushBinding(session: CacheSession): Promise<PushBinding | null> {
  return transaction(async (tx) => {
    const { c } = await checked(tx, session);
    return c.push ?? null;
  });
}
export async function writePushBinding(session: CacheSession, push: PushBinding | null) {
  await transaction(async (tx) => {
    const { c } = await checked(tx, session);
    if (push) c.push = push;
    else delete c.push;
    tx.objectStore('control').put(c, 'owner');
  });
  emit();
}
