/**
 * Grants or revokes the clinician role. Server-side only (Firebase Admin SDK).
 *
 *   Local emulator:  npm run grant-clinician -- --emulator someone@example.com
 *   Real project:    GOOGLE_APPLICATION_CREDENTIALS=/path/outside/repo/key.json \
 *                    npm run grant-clinician -- --project your-project-id someone@example.com
 *   Revoke:          add --revoke (also removes every share the clinician holds)
 *
 * The role is written to /roles/{uid}, which clients can read for themselves but never write
 * (see firebase/firestore.rules). The user must sign out and in again for the app to pick it up.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { EMULATOR_PROJECT_ID } from '../src/data/firebaseConfig';

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error('Usage: npm run grant-clinician -- [--emulator | --project <id>] [--revoke] <email>');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const emulator = args.includes('--emulator');
  const revoke = args.includes('--revoke');
  const pIdx = args.indexOf('--project');
  const projectId = pIdx >= 0 ? args[pIdx + 1] : undefined;
  const email = args.filter((a, i) => !a.startsWith('--') && !(pIdx >= 0 && i === pIdx + 1))[0];
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) usage('An email address is required.');
  if (!emulator && !projectId) usage('Pass --emulator or --project <id>.');

  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  }
  const app = emulator ? initializeApp({ projectId: EMULATOR_PROJECT_ID }) : initializeApp({ credential: applicationDefault(), projectId });
  const user = await getAuth(app).getUserByEmail(email.toLowerCase());
  const db = getFirestore(app);
  if (revoke) {
    await db.doc(`roles/${user.uid}`).delete();
    const shares = await db.collection('shares').where('clinicianUid', '==', user.uid).get();
    const batch = db.batch();
    shares.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`Revoked clinician role for ${email} (${user.uid}); removed ${shares.size} share(s).`);
  } else {
    if (!user.emailVerified) console.warn('Note: this email is not verified yet. The clinician must verify it before accepting invitations.');
    await db.doc(`roles/${user.uid}`).set({ role: 'clinician', grantedAt: FieldValue.serverTimestamp(), grantedBy: 'grant-clinician-script' });
    console.log(`Granted clinician role to ${email} (${user.uid}). Ask them to sign out and back in.`);
  }
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error('Failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
