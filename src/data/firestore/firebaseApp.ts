import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
import type { FirebaseMode } from '../firebaseConfig';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: FirebaseHandles | null = null;

/**
 * Initialises Firebase once. Firestore uses an in-memory cache only, so health records are
 * not persisted in the browser's IndexedDB after the tab closes.
 */
export function initFirebase(mode: Exclude<FirebaseMode, { kind: 'missing' }>): FirebaseHandles {
  if (handles) return handles;
  const app = initializeApp(mode.config);
  if (mode.kind === 'project' && mode.appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(mode.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (mode.kind === 'emulator') {
    connectAuthEmulator(auth, mode.authHost, { disableWarnings: true });
    connectFirestoreEmulator(db, mode.firestoreHost, mode.firestorePort);
  }
  handles = { app, auth, db };
  return handles;
}
