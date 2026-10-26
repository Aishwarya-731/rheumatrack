/**
 * Reads Firebase configuration from Vite environment variables (see .env.example).
 * The Firebase web config is not secret (it identifies the project; access is controlled by
 * Security Rules), but it is still kept out of source control.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export type FirebaseMode =
  | { kind: 'emulator'; config: FirebaseWebConfig; authHost: string; firestoreHost: string; firestorePort: number }
  | { kind: 'project'; config: FirebaseWebConfig; appCheckSiteKey: string | null }
  | { kind: 'missing'; missing: string[] };

export const EMULATOR_PROJECT_ID = 'demo-rheumatrack';

interface EnvLike {
  [key: string]: string | boolean | undefined;
}

export function resolveFirebaseMode(env: EnvLike = import.meta.env as unknown as EnvLike): FirebaseMode {
  const str = (k: string): string => {
    const v = env[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  if (str('VITE_USE_EMULATORS') === 'true') {
    return {
      kind: 'emulator',
      config: {
        apiKey: 'demo-api-key',
        authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
        projectId: EMULATOR_PROJECT_ID,
        appId: 'demo-app-id',
      },
      authHost: str('VITE_EMULATOR_AUTH_URL') || 'http://127.0.0.1:9099',
      firestoreHost: str('VITE_EMULATOR_FIRESTORE_HOST') || '127.0.0.1',
      firestorePort: Number(str('VITE_EMULATOR_FIRESTORE_PORT') || 8080),
    };
  }
  const required = {
    VITE_FIREBASE_API_KEY: str('VITE_FIREBASE_API_KEY'),
    VITE_FIREBASE_AUTH_DOMAIN: str('VITE_FIREBASE_AUTH_DOMAIN'),
    VITE_FIREBASE_PROJECT_ID: str('VITE_FIREBASE_PROJECT_ID'),
    VITE_FIREBASE_APP_ID: str('VITE_FIREBASE_APP_ID'),
  };
  const missing = Object.entries(required)
    .filter(([, v]) => v === '')
    .map(([k]) => k);
  if (missing.length > 0) return { kind: 'missing', missing };
  const config: FirebaseWebConfig = {
    apiKey: required.VITE_FIREBASE_API_KEY,
    authDomain: required.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: required.VITE_FIREBASE_PROJECT_ID,
    appId: required.VITE_FIREBASE_APP_ID,
  };
  if (str('VITE_FIREBASE_STORAGE_BUCKET')) config.storageBucket = str('VITE_FIREBASE_STORAGE_BUCKET');
  if (str('VITE_FIREBASE_MESSAGING_SENDER_ID')) config.messagingSenderId = str('VITE_FIREBASE_MESSAGING_SENDER_ID');
  return { kind: 'project', config, appCheckSiteKey: str('VITE_APPCHECK_RECAPTCHA_ENTERPRISE_KEY') || null };
}
