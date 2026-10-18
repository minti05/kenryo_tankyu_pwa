async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('push_operation_timeout')), 4000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
/** Stop the browser endpoint, not the shared service worker used by PDF/offline. */
export async function unsubscribeBrowserPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await bounded(navigator.serviceWorker.getRegistration('/'));
  if (registration?.pushManager) {
    const subscription = await bounded(registration.pushManager.getSubscription());
    if (subscription && !(await bounded(subscription.unsubscribe())))
      throw new Error('push_unsubscribe_failed');
  }
  const notifications =
    typeof registration?.getNotifications === 'function'
      ? await bounded(registration.getNotifications())
      : [];
  notifications?.forEach((n) => {
    if (n.tag.startsWith('archive-')) n.close();
  });
}
