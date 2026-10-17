import * as offlineFixtureStore from '../src/features/offline/store';
Object.assign(window, { offlineFixtureStore });
// Bundler replacement ONLY in the explicit isolated offline test build. Never used by normal build.
export const authConfigured = true;
function user() {
  const uid = localStorage.getItem('offline-fixture-user');
  return uid
    ? {
        uid,
        email: 'fixture@kenryo.ed.jp',
        emailVerified: true,
        providerData: [{ providerId: 'google.com' }],
        getIdToken: async () => 'fixture-token',
      }
    : null;
}
const auth = { currentUser: user() };
export async function initializeAuth() {
  return {
    auth,
    provider: {},
    sdk: {
      onIdTokenChanged: (_auth: unknown, fn: () => void) => {
        const cb = () => {
          auth.currentUser = user();
          fn();
        };
        queueMicrotask(cb);
        window.addEventListener('offline-fixture-user', cb);
        return () => window.removeEventListener('offline-fixture-user', cb);
      },
      signOut: async () => {
        localStorage.removeItem('offline-fixture-user');
        auth.currentUser = null;
        window.dispatchEvent(new Event('offline-fixture-user'));
      },
      signInWithPopup: async () => {},
    },
  };
}
