import type { Messaging, MessagePayload } from 'firebase/messaging';
const callbacks = new Set<(payload: MessagePayload) => void>();
window.addEventListener('fixture-fcm-message', (event) => {
  const payload = (event as CustomEvent<MessagePayload>).detail;
  callbacks.forEach((fn) => fn(payload));
});
export const isSupported = async () => localStorage.getItem('fixture-push-unsupported') !== '1';
export const getMessaging = () => ({}) as Messaging;
export async function getToken(
  _m: Messaging,
  options: { serviceWorkerRegistration: ServiceWorkerRegistration; vapidKey?: string },
) {
  if (options.serviceWorkerRegistration.scope !== location.origin + '/')
    throw Error('wrong_service_worker');
  return localStorage.getItem('fixture-push-token') ?? 'fixture-push-token-000000000000';
}
export async function deleteToken() {
  return true;
}
export function onMessage(_m: Messaging, callback: (payload: MessagePayload) => void) {
  callbacks.add(callback);
  Object.assign(window, { fixtureMessagingReady: true });
  return () => callbacks.delete(callback);
}
