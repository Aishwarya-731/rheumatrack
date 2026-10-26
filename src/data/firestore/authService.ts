import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { toAppError } from '../errors';
import type { AuthService, AuthUser } from '../services';

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    email: u.email ?? '',
    emailVerified: u.emailVerified,
    displayName: u.displayName ?? '',
  };
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toAppError(e);
  }
}

export function createFirebaseAuthService(auth: Auth): AuthService {
  const requireUser = (): User => {
    const u = auth.currentUser;
    if (!u) throw toAppError({ code: 'auth/no-current-user' });
    return u;
  };
  return {
    onChange(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
    },
    signIn: (email, password) => wrap(async () => void (await signInWithEmailAndPassword(auth, email.trim(), password))),
    signUp: (email, password, displayName) =>
      wrap(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        return { ...toAuthUser(cred.user), displayName: displayName.trim() };
      }),
    signOut: () => wrap(() => signOut(auth)),
    sendPasswordReset: (email) => wrap(() => sendPasswordResetEmail(auth, email.trim())),
    sendEmailVerification: () => wrap(() => sendEmailVerification(requireUser())),
    reload: () =>
      wrap(async () => {
        const u = auth.currentUser;
        if (!u) return null;
        await u.reload();
        await u.getIdToken(true); // refresh token so email_verified reaches Security Rules
        return toAuthUser(u);
      }),
    updateDisplayName: (name) => wrap(() => updateProfile(requireUser(), { displayName: name.trim() })),
    reauthenticate: (password) =>
      wrap(async () => {
        const u = requireUser();
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email ?? '', password));
      }),
    deleteAccount: (password) =>
      wrap(async () => {
        const u = requireUser();
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email ?? '', password));
        await deleteUser(u);
      }),
  };
}
