// Only the isolated .cache/offline-build can resolve this module.
export const pushConfigured = true;
export async function firebaseApp() {
  return {} as import('firebase/app').FirebaseApp;
}
