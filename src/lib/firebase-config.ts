export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
export const pushConfigured =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId &&
  !!firebaseConfig.appId &&
  !!firebaseConfig.messagingSenderId &&
  /^[A-Za-z0-9_-]{87}$/.test(import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '');
export async function firebaseApp() {
  const sdk = await import('firebase/app');
  return sdk.getApps()[0] ?? sdk.initializeApp(firebaseConfig);
}
