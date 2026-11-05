/// <reference lib="webworker" />
import { PrecacheController } from 'workbox-precaching';
export type ShellEntry = { url: string; revision?: string | null; integrity?: string };
const html = (r: Response) => r.ok && !!r.headers.get('content-type')?.includes('text/html');
// A followed redirect must never be returned unchanged for a navigation.
const clean = (r: Response) =>
  new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers });
export function createShell(scope: ServiceWorkerGlobalScope, manifest: ShellEntry[]) {
  const index = manifest.find((e) => /^(\/)?index\.html$/.test(e.url));
  if (!index?.revision || !index.integrity) throw new Error('shell_integrity_missing');
  const prefix = `tankyu-shell-${scope.registration.scope}::`;
  const cacheName = prefix + index.revision;
  const controller = new PrecacheController({
    cacheName,
    plugins: [
      {
        cacheWillUpdate: async ({ request, response }) => {
          if (!response.ok) return null;
          const path = new URL(request.url).pathname;
          const type = response.headers.get('content-type') ?? '';
          if (/\.html$/.test(path) && !type.includes('text/html')) return null;
          if (/\.js$/.test(path) && !/javascript|ecmascript/.test(type)) return null;
          if (/\.css$/.test(path) && !type.includes('text/css')) return null;
          return clean(response);
        },
      },
    ],
  });
  controller.addToCacheList(manifest);
  const shellCache = (name: string) =>
    name.startsWith(prefix) ||
    (name.startsWith('workbox-precache-v2-') && name.endsWith(scope.registration.scope));
  async function restore(entry: ShellEntry) {
    const key = controller.getCacheKeyForURL(entry.url);
    if (!key || !entry.integrity) throw new Error('shell_entry_invalid');
    const response = await fetch(new URL(entry.url, scope.location.origin), {
      cache: 'reload',
      integrity: entry.integrity,
    });
    if (!response.ok) throw new Error('shell_fetch_failed');
    const result = clean(response);
    await (await caches.open(cacheName)).put(key, result.clone());
    return result;
  }
  async function navigation() {
    try {
      // Validate presence of this release's whole shell, including modules needed at boot.
      // Browser eviction may remove a complete cache, not only index.html.
      try {
        await repair();
        const cached = await controller.matchPrecache('/index.html');
        if (cached && html(cached)) return clean(cached);
      } catch {
        /* The published release may have advanced. */
      }
      const fresh = await fetch(new URL('/', scope.location.origin), { cache: 'no-store' });
      if (html(fresh)) return clean(fresh);
    } catch {
      /* A missing shell must produce a page, not a rejected navigation. */
    }
    return new Response(
      '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>探究アーカイブ</title><body style="font:16px system-ui;padding:32px;line-height:1.8"><h1>アプリを開けませんでした</h1><p>通信に接続して、もう一度お試しください。</p><p><a href="/welcome">もう一度開く</a>　<a href="/assets/recover.html">修復して開く</a></p></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
  async function asset(request: Request) {
    const current = await controller.matchPrecache(request.url);
    if (current) return current;
    // Other open tabs may still need chunks from the preceding release.
    for (const name of (await caches.keys()).filter(shellCache).reverse()) {
      if (name === cacheName) continue;
      const cached = await (await caches.open(name)).match(request);
      if (cached) return cached;
    }
    const entry = manifest.find((e) => new URL(e.url, scope.location.origin).href === request.url);
    if (entry) return restore(entry);
    return fetch(request);
  }
  let repairing: Promise<void> | undefined;
  function repair() {
    return (repairing ??= (async () => {
      const cache = await caches.open(cacheName);
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (cursor < manifest.length) {
            const entry = manifest[cursor++]!;
            const key = controller.getCacheKeyForURL(entry.url);
            if (key && !(await cache.match(key))) await restore(entry);
          }
        }),
      );
    })().finally(() => {
      repairing = undefined;
    }));
  }
  async function prune() {
    const previous = (await caches.keys()).filter((n) => n !== cacheName && shellCache(n));
    // Bounded retention for old tabs. PDF caches and account data are separate.
    await Promise.all(
      previous.slice(0, Math.max(0, previous.length - 3)).map((n) => caches.delete(n)),
    );
  }
  return { controller, navigation, asset, repair, prune };
}
