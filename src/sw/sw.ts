/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision?: string | null }[];
};
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// 保護API・PDFはこの外枠用SWで保存しない。通知も後続でこの単一SWへ統合する。
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(?:\/|$)/, /^\/assets(?:\/|$)/],
  }),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
