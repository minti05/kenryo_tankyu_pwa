/// <reference lib="webworker" />
// A test-only OS notification sink. Calls the production parser, binding gate and click handler.
import { installNotifications as install, showArchivePush } from '../src/sw/notifications';
export function installNotifications(scope: ServiceWorkerGlobalScope) {
  const opened: string[] = [];
  const fake = {
    addEventListener: scope.addEventListener.bind(scope),
    location: scope.location,
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => {
        opened.push(url);
        return null;
      },
    },
  } as unknown as ServiceWorkerGlobalScope;
  install(fake);
  scope.addEventListener('message', (event) => {
    if (!['FIXTURE_PUSH', 'FIXTURE_CLICK'].includes(event.data?.type)) return;
    event.waitUntil(
      (async () => {
        const shown: unknown[] = [];
        if (event.data.type === 'FIXTURE_PUSH')
          await showArchivePush(
            {
              registration: {
                showNotification: async (title: string, options: unknown) => {
                  shown.push({ title, options });
                },
              },
            } as unknown as ServiceWorkerGlobalScope,
            event.data.data,
          );
        else {
          const e = new Event('notificationclick');
          let work: Promise<unknown> = Promise.resolve();
          Object.defineProperties(e, {
            notification: {
              value: {
                tag: 'archive-' + event.data.data.noticeId,
                data: event.data.data,
                close() {},
              },
            },
            waitUntil: {
              value: (promise: Promise<unknown>) => {
                work = promise;
              },
            },
          });
          scope.dispatchEvent(e);
          await work;
        }
        event.ports[0]?.postMessage({ shown, opened });
      })(),
    );
  });
}
