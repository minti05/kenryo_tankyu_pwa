/// <reference lib="webworker" />
import { PrecacheRoute } from 'workbox-precaching';
import { createShell } from './shell';
import { installNotifications } from './notifications';
import { sweepOffline } from './expiry';
import { pdfAssetRequest, cachedPdfAsset, prepareAssets } from './pdf-assets';
import { NavigationRoute, registerRoute } from 'workbox-routing';
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision?: string | null; integrity?: string }[];
};
installNotifications(self);
const shell = createShell(self, self.__WB_MANIFEST);
self.addEventListener('install', (event) => event.waitUntil(shell.controller.install(event)));
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      await shell.controller.activate(event);
      await shell.prune();
      await self.clients.claim();
    })(),
  ),
);
registerRoute(
  new NavigationRoute(() => shell.navigation(), {
    denylist: [/^\/api(?:\/|$)/, /^\/assets(?:\/|$)/],
  }),
);
registerRoute(
  ({ request }) => pdfAssetRequest(request),
  ({ request }) => cachedPdfAsset(request),
);
self.addEventListener('activate', (event) => event.waitUntil(sweepOffline().catch(() => {})));
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.waitUntil(sweepOffline().catch(() => {}));
});
// 保護API・PDFはこの外枠用SWで保存しない。通知もこの単一SWで受信する。
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    /^\/assets\/[a-zA-Z0-9._-]+-[a-zA-Z0-9_-]{8,}\.(js|css)$/.test(url.pathname),
  ({ request }) => shell.asset(request),
);
registerRoute(new PrecacheRoute(shell.controller));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PREPARE_PDF_ASSETS')
    event.waitUntil(
      prepareAssets({ background: event.data.background === true })
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch(() => event.ports[0]?.postMessage({ ok: false })),
    );
  if (event.data?.type === 'REPAIR_SHELL')
    event.waitUntil(
      shell
        .repair()
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch(() => event.ports[0]?.postMessage({ ok: false })),
    );
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
