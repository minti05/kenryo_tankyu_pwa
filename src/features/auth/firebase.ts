import { firebaseConfig as config } from '../../lib/firebase-config';
export const authConfigured = [config.apiKey, config.authDomain, config.projectId].every(
  (value) => typeof value === 'string' && value.trim().length > 0,
);
let pending: ReturnType<typeof createRuntime> | undefined;
async function createRuntime() {
  if (
    !authConfigured ||
    !/^[a-z][a-z0-9-]{4,60}$/.test(config.projectId) ||
    !/^[a-z0-9.-]+$/.test(config.authDomain)
  )
    throw new Error('auth_not_configured');
  const [{ initializeApp }, sdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);
  const auth = sdk.getAuth(initializeApp(config));
  await sdk.setPersistence(auth, sdk.browserLocalPersistence);
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ hd: 'kenryo.ed.jp', prompt: 'select_account' });
  return { auth, provider, sdk };
}
export function initializeAuth() {
  return (pending ??= createRuntime());
}
