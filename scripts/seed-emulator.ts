/**
 * Seeds the LOCAL Firebase Emulator Suite with demo accounts and clearly labelled SYNTHETIC data.
 *
 *   npm run emulators   (terminal 1)
 *   npm run seed        (terminal 2)
 *
 * Refuses to run unless both emulator host variables are set, so it can never touch a real
 * project. Records are written through the same client data layer and Security Rules the app
 * uses (signed in as each demo user); only the clinician role is written with the Admin SDK,
 * exactly as scripts/grant-clinician.ts does in production.
 */
import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { createFirestoreDataService } from '../src/data/firestore/dataService';
import { EMULATOR_PROJECT_ID } from '../src/data/firebaseConfig';
import { DEFAULT_REMINDERS } from '../src/domain/reminders';
import { addSyntheticSampleData } from '../src/features/settings/syntheticSeed';

const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FIRESTORE || !AUTH) {
  console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must point at the local emulators.');
  process.exit(1);
}

export const DEMO = {
  patient: { email: 'patient@rheumatrack.test', password: 'Patient123', name: 'Asha Raman (demo)' },
  clinician: { email: 'clinician@rheumatrack.test', password: 'Clinician123', name: 'Dr. Priya Nair (demo)' },
};

async function main() {
  const admin = initAdmin({ projectId: EMULATOR_PROJECT_ID });
  const adminAuth = getAdminAuth(admin);
  const adminDb = getAdminDb(admin);

  const ensureUser = async (u: { email: string; password: string; name: string }) => {
    try {
      const existing = await adminAuth.getUserByEmail(u.email);
      return existing.uid;
    } catch {
      const created = await adminAuth.createUser({ email: u.email, password: u.password, displayName: u.name, emailVerified: true });
      return created.uid;
    }
  };
  const patientUid = await ensureUser(DEMO.patient);
  const clinicianUid = await ensureUser(DEMO.clinician);
  await adminDb.doc(`roles/${clinicianUid}`).set({ role: 'clinician', grantedAt: FieldValue.serverTimestamp(), grantedBy: 'seed-emulator' });

  const app = initializeApp({ apiKey: 'demo-api-key', projectId: EMULATOR_PROJECT_ID, authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`, appId: 'demo-app-id' });
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  const [host, port] = (FIRESTORE as string).split(':');
  connectFirestoreEmulator(db, host as string, Number(port));
  const data = createFirestoreDataService(db);

  // Patient: profile + synthetic records + invitation to the demo clinician.
  await signInWithEmailAndPassword(auth, DEMO.patient.email, DEMO.patient.password);
  if (!(await data.getProfile(patientUid))) {
    await data.createProfile(patientUid, { displayName: DEMO.patient.name, email: DEMO.patient.email, reminders: { ...DEFAULT_REMINDERS, timezone: 'Asia/Kolkata' } });
  }
  const existingSessions = await new Promise<number>((resolve, reject) => {
    const unsub = data.subscribeSessions(patientUid, (s) => (unsub(), resolve(s.length)), reject);
  });
  if (existingSessions === 0) {
    const r = await addSyntheticSampleData(data, patientUid);
    console.log(`  synthetic: ${r.sessions} sessions, ${r.assessments} check-ins`);
  } else {
    console.log(`  patient already has ${existingSessions} sessions — skipping synthetic data`);
  }
  const invites = await new Promise<Awaited<ReturnType<typeof data.createInvite>>[]>((resolve, reject) => {
    const unsub = data.subscribeInvitesByPatient(patientUid, (i) => (unsub(), resolve(i.filter((x) => x.status !== 'revoked').map((x) => x.id))), reject);
  });
  if (invites.length === 0) await data.createInvite(patientUid, DEMO.patient.name, DEMO.clinician.email);
  await signOut(auth);

  // Clinician: profile + accept the invitation (creates the share through the Security Rules).
  await signInWithEmailAndPassword(auth, DEMO.clinician.email, DEMO.clinician.password);
  if (!(await data.getProfile(clinicianUid))) {
    await data.createProfile(clinicianUid, { displayName: DEMO.clinician.name, email: DEMO.clinician.email, reminders: { ...DEFAULT_REMINDERS } });
  }
  const pending = await new Promise<Parameters<typeof data.acceptInvite>[0][]>((resolve, reject) => {
    const unsub = data.subscribePendingInvitesForClinician(DEMO.clinician.email, (i) => (unsub(), resolve(i)), reject);
  });
  for (const inv of pending) await data.acceptInvite(inv, clinicianUid, DEMO.clinician.email);
  await signOut(auth);

  console.log('\nSeeded the local emulator (synthetic data only):');
  console.log(`  Patient   ${DEMO.patient.email} / ${DEMO.patient.password}`);
  console.log(`  Clinician ${DEMO.clinician.email} / ${DEMO.clinician.password}  (shared with the patient)`);
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error('Seeding failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
