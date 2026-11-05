// Shared for the entire document, including remounts and development StrictMode.
let registration: Promise<ServiceWorkerRegistration | null> | undefined;
let current: ServiceWorkerRegistration | null = null;
let needed = false;
let reloadRequested = false;
let accepted = false;
let applying: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const subscribeUpdates = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const updateSnapshot = () => needed;
const publish = () => {
  const next = !!current?.waiting;
  if (needed !== next) {
    needed = next;
    listeners.forEach((listener) => listener());
  }
};
function reloadOnce() {
  if (reloadRequested) return;
  reloadRequested = true;
  window.location.reload();
}
export function startUpdates() {
  if (registration) return registration;
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return Promise.resolve(null);
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    publish();
    if (hadController || accepted) reloadOnce();
  });
  registration = navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => {
      current = reg;
      const observe = () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', publish);
        publish();
      };
      reg.addEventListener('updatefound', observe);
      observe();
      let checkedAt = Date.now();
      const check = () => {
        if (document.visibilityState !== 'visible' || Date.now() - checkedAt < 60_000) return;
        checkedAt = Date.now();
        void reg.update().catch(() => {});
      };
      window.addEventListener('focus', check);
      window.addEventListener('online', check);
      return reg;
    })
    .catch(() => null);
  return registration;
}
function settled(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('update_timeout')), 30000);
    const check = () => {
      if (worker.state === 'installed' || worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('update_replaced'));
    };
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      if (error) reject(error);
      else resolve();
    };
    worker.addEventListener('statechange', check);
    check();
  });
}
export function applyUpdate() {
  return (applying ??= (async () => {
    const reg = await startUpdates();
    if (!reg) throw new Error('update_unavailable');
    // Prefer the latest fully installed release if several deployments arrived.
    await reg.update();
    if (reg.installing) await settled(reg.installing);
    const worker = reg.waiting;
    accepted = true;
    if (!worker) {
      reloadOnce();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish(new Error('update_timeout')), 30000);
      const changed = () => finish();
      const finish = (error?: Error) => {
        window.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', changed);
        if (error) reject(error);
        else resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  })().finally(() => {
    applying = undefined;
  }));
}
