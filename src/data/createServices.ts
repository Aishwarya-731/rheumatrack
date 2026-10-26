import type { FirebaseMode } from './firebaseConfig';
import { createFirebaseAuthService } from './firestore/authService';
import { createFirestoreDataService } from './firestore/dataService';
import { initFirebase } from './firestore/firebaseApp';
import type { Services } from './services';

export function createFirebaseServices(mode: Exclude<FirebaseMode, { kind: 'missing' }>): Services {
  const { auth, db } = initFirebase(mode);
  return {
    auth: createFirebaseAuthService(auth),
    data: createFirestoreDataService(db),
    mode: mode.kind,
  };
}
