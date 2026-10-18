/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { installNotifications } from './notifications';
import { sweepOffline } from './expiry';
import { pdfAssetRequest, cachedPdfAsset, prepareAssets } from './pdf-assets';
import { NavigationRoute, registerRoute } from 'workbox-routing';
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision?: string | null }[];
};
installNotifications(self);
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
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
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(?:\/|$)/, /^\/assets(?:\/|$)/],
  }),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PREPARE_PDF_ASSETS')
    event.waitUntil(
      prepareAssets()
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch(() => event.ports[0]?.postMessage({ ok: false })),
    );
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
