const CACHE = 'tankyu-pdf-assets-v1';
const allowed = (url: URL) =>
  url.origin === self.location.origin &&
  !url.search &&
  (/^\/assets\/(pdf-runtime-[a-zA-Z0-9_-]+\.js|pdf\.worker[^/]+\.mjs)$/.test(url.pathname) ||
    /^\/embedpdf\/2\.15\.1\/[a-zA-Z0-9_./-]+$/.test(url.pathname));
let pending: Promise<void> | undefined;
export function pdfAssetRequest(request: Request) {
  return request.method === 'GET' && allowed(new URL(request.url));
}
export async function cachedPdfAsset(request: Request) {
  return (await (await caches.open(CACHE)).match(request, { ignoreVary: true })) ?? fetch(request);
}
export function prepareAssets(options: { background?: boolean } = {}) {
  return (pending ??= prepare(options.background === true).finally(() => {
    pending = undefined;
  }));
}
async function prepare(background: boolean) {
  const r = await fetch('/pdf-offline-manifest.json', { cache: 'no-store', redirect: 'error' });
  if (!r.ok) throw new Error('manifest');
  const manifest: { version: string; files: { url: string; size: number; sha256: string }[] } =
    await r.json();
  if (
    manifest.version !== '1' ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 500 ||
    !manifest.files.length ||
    manifest.files.reduce((n, f) => n + f.size, 0) > 30_000_000
  )
    throw new Error('manifest');
  const cache = await caches.open(CACHE),
    wanted = new Set<string>();
  // Fetch the engine before fallback fonts; background work uses one transfer at a time.
  manifest.files.sort((a, b) => {
    const rank = (url: string) =>
      url.endsWith('.wasm') ? 0 : url.endsWith('.js') ? 1 : url.includes('/fonts/') ? 2 : 3;
    return rank(a.url) - rank(b.url);
  });
  let index = 0;
  await Promise.all(
    Array.from({ length: background ? 1 : 4 }, async () => {
      while (index < manifest.files.length) {
        const file = manifest.files[index++]!,
          url = new URL(file.url, self.location.origin);
        if (
          !allowed(url) ||
          file.url !== url.pathname ||
          !Number.isSafeInteger(file.size) ||
          file.size < 1 ||
          !/^[a-f0-9]{64}$/.test(file.sha256)
        )
          throw new Error('manifest');
        wanted.add(url.href);
        let response = await cache.match(url.href, { ignoreVary: true });
        if (!response)
          response = await fetch(url.href, {
            cache: 'no-store',
            redirect: 'error',
            priority: background ? 'low' : 'auto',
          });
        if (!response.ok || response.type === 'opaque') throw new Error('asset');
        const bytes = await response.clone().arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (bytes.byteLength !== file.size || hash !== file.sha256) {
          await cache.delete(url.href);
          throw new Error('asset_hash');
        }
        await cache.put(url.href, response);
      }
    }),
  );
  // Only after all current files pass. Failed updates leave the previous viewer available.
  for (const request of await cache.keys())
    if (!wanted.has(request.url)) await cache.delete(request);
}
