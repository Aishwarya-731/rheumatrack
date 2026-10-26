import { DEFAULT_REMINDERS } from '@/domain/reminders';
import type {
  AngleSample,
  CalibrationRecord,
  MovementSession,
  Role,
  ShareGrant,
  ShareInvite,
  SymptomAssessment,
  UserProfile,
} from '@/domain/types';
import { AppError } from '../errors';
import type { AuthService, AuthUser, DataService, Services, Unsubscribe } from '../services';

/**
 * In-memory implementation of the service interfaces, used by automated tests only.
 * It mirrors the access rules of firestore.rules for the operations the UI performs, so
 * component tests exercise the same permission behaviour (owner or active share).
 */

type Listener = () => void;

interface Account {
  user: AuthUser;
  password: string;
}

export interface MemoryState {
  accounts: Map<string, Account>;
  roles: Map<string, Role>;
  profiles: Map<string, UserProfile>;
  sessions: Map<string, MovementSession[]>;
  samples: Map<string, AngleSample[]>;
  assessments: Map<string, SymptomAssessment[]>;
  calibrations: Map<string, CalibrationRecord[]>;
  invites: ShareInvite[];
  shares: ShareGrant[];
}

export function createMemoryState(): MemoryState {
  return {
    accounts: new Map(),
    roles: new Map(),
    profiles: new Map(),
    sessions: new Map(),
    samples: new Map(),
    assessments: new Map(),
    calibrations: new Map(),
    invites: [],
    shares: [],
  };
}

export function createMemoryServices(state: MemoryState = createMemoryState(), now: () => number = () => Date.now()): Services & {
  state: MemoryState;
  signInAs(uid: string): void;
} {
  let current: AuthUser | null = null;
  let idCounter = 0;
  const nextId = (p: string) => `${p}${++idCounter}`;
  const authListeners = new Set<(u: AuthUser | null) => void>();
  const dataListeners = new Set<Listener>();
  const emitAuth = () => authListeners.forEach((l) => l(current));
  const emit = () => dataListeners.forEach((l) => l());

  const requireUser = (): AuthUser => {
    if (!current) throw new AppError('permission-denied');
    return current;
  };
  const canRead = (ownerUid: string) => {
    const u = requireUser();
    if (u.uid === ownerUid) return;
    const isClin = state.roles.get(u.uid) === 'clinician';
    if (isClin && state.shares.some((s) => s.patientUid === ownerUid && s.clinicianUid === u.uid)) return;
    throw new AppError('permission-denied');
  };
  const canWrite = (ownerUid: string) => {
    if (requireUser().uid !== ownerUid) throw new AppError('permission-denied');
  };

  function subscribe<T>(get: () => T, cb: (v: T) => void, onError: (e: Error) => void): Unsubscribe {
    const fire = () => {
      try {
        cb(get());
      } catch (e) {
        onError(e as Error);
      }
    };
    dataListeners.add(fire);
    queueMicrotask(fire);
    return () => dataListeners.delete(fire);
  }

  const list = <T>(m: Map<string, T[]>, uid: string): T[] => m.get(uid) ?? [];

  const auth: AuthService = {
    onChange(cb) {
      authListeners.add(cb);
      queueMicrotask(() => cb(current));
      return () => authListeners.delete(cb);
    },
    async signIn(email, password) {
      const acc = [...state.accounts.values()].find((a) => a.user.email === email.trim().toLowerCase());
      if (!acc || acc.password !== password) throw new AppError('auth/invalid-credential');
      current = { ...acc.user };
      emitAuth();
    },
    async signUp(email, password, displayName) {
      const e = email.trim().toLowerCase();
      if ([...state.accounts.values()].some((a) => a.user.email === e)) throw new AppError('auth/email-already-in-use');
      if (password.length < 8) throw new AppError('auth/weak-password');
      const user: AuthUser = { uid: nextId('uid-'), email: e, emailVerified: false, displayName };
      state.accounts.set(user.uid, { user, password });
      current = { ...user };
      emitAuth();
      return user;
    },
    async signOut() {
      current = null;
      emitAuth();
    },
    async sendPasswordReset() {
      /* accepted silently, like Firebase with email enumeration protection */
    },
    async sendEmailVerification() {
      requireUser();
    },
    async reload() {
      return current;
    },
    async updateDisplayName(name) {
      const u = requireUser();
      u.displayName = name;
      const acc = state.accounts.get(u.uid);
      if (acc) acc.user.displayName = name;
      emitAuth();
    },
    async reauthenticate(password) {
      const u = requireUser();
      if (state.accounts.get(u.uid)?.password !== password) throw new AppError('auth/invalid-credential');
    },
    async deleteAccount(password) {
      await auth.reauthenticate(password);
      const u = requireUser();
      state.accounts.delete(u.uid);
      current = null;
      emitAuth();
    },
  };

  const data: DataService = {
    async getProfile(uid) {
      canRead(uid);
      return state.profiles.get(uid) ?? null;
    },
    async createProfile(uid, input) {
      canWrite(uid);
      state.profiles.set(uid, {
        uid,
        displayName: input.displayName,
        email: input.email,
        createdAt: now(),
        reminders: input.reminders,
        preferredJoint: null,
        preferredSide: null,
      });
      emit();
    },
    async updateProfile(uid, patch) {
      canWrite(uid);
      const p = state.profiles.get(uid);
      if (!p) throw new AppError('not-found');
      state.profiles.set(uid, { ...p, ...patch });
      emit();
    },
    subscribeProfile(uid, cb, onError) {
      return subscribe(() => (canRead(uid), state.profiles.get(uid) ?? null), cb, onError);
    },
    async getRole(uid) {
      return state.roles.get(uid) ?? 'patient';
    },

    subscribeSessions(ownerUid, cb, onError) {
      return subscribe(() => (canRead(ownerUid), [...list(state.sessions, ownerUid)].sort((a, b) => b.startedAt - a.startedAt)), cb, onError);
    },
    async createSession(ownerUid, input, samples) {
      canWrite(ownerUid);
      const id = nextId('s');
      const first = samples[0] as AngleSample;
      const last = samples[samples.length - 1] as AngleSample;
      const s: MovementSession = {
        ...input,
        id,
        ownerUid,
        startedAt: first.t,
        endedAt: last.t,
        createdAt: now(),
        chunkCount: 1,
        schemaVersion: 1,
      };
      state.sessions.set(ownerUid, [...list(state.sessions, ownerUid), s]);
      state.samples.set(id, samples.map((x) => ({ ...x })));
      emit();
      return id;
    },
    async getSessionSamples(ownerUid, session) {
      canRead(ownerUid);
      const s = state.samples.get(session.id);
      if (!s) throw new AppError('not-found');
      return s.map((x) => ({ ...x }));
    },
    async updateSessionNotes(ownerUid, id, notes) {
      canWrite(ownerUid);
      state.sessions.set(ownerUid, list(state.sessions, ownerUid).map((s) => (s.id === id ? { ...s, notes } : s)));
      emit();
    },
    async deleteSession(ownerUid, session) {
      canWrite(ownerUid);
      state.sessions.set(ownerUid, list(state.sessions, ownerUid).filter((s) => s.id !== session.id));
      state.samples.delete(session.id);
      emit();
    },

    subscribeAssessments(ownerUid, cb, onError) {
      return subscribe(() => (canRead(ownerUid), [...list(state.assessments, ownerUid)].sort((a, b) => b.assessedAt - a.assessedAt)), cb, onError);
    },
    async createAssessment(ownerUid, input, isSynthetic = false) {
      canWrite(ownerUid);
      const id = nextId('a');
      const t = now();
      state.assessments.set(ownerUid, [
        ...list(state.assessments, ownerUid),
        { ...input, id, ownerUid, createdAt: t, updatedAt: null, isSynthetic, schemaVersion: 1 },
      ]);
      emit();
      return id;
    },
    async updateAssessment(ownerUid, id, input) {
      canWrite(ownerUid);
      state.assessments.set(ownerUid, list(state.assessments, ownerUid).map((a) => (a.id === id ? { ...a, ...input, updatedAt: now() } : a)));
      emit();
    },
    async deleteAssessment(ownerUid, id) {
      canWrite(ownerUid);
      state.assessments.set(ownerUid, list(state.assessments, ownerUid).filter((a) => a.id !== id));
      emit();
    },

    subscribeCalibrations(ownerUid, cb, onError) {
      return subscribe(() => (canRead(ownerUid), [...list(state.calibrations, ownerUid)].sort((a, b) => b.createdAt - a.createdAt)), cb, onError);
    },
    async createCalibration(ownerUid, input) {
      canWrite(ownerUid);
      const id = nextId('c');
      state.calibrations.set(ownerUid, [...list(state.calibrations, ownerUid), { ...input, id, ownerUid, createdAt: now(), schemaVersion: 1 }]);
      emit();
      return id;
    },
    async deleteCalibration(ownerUid, id) {
      canWrite(ownerUid);
      state.calibrations.set(ownerUid, list(state.calibrations, ownerUid).filter((c) => c.id !== id));
      emit();
    },

    subscribeInvitesByPatient(patientUid, cb, onError) {
      return subscribe(() => (canWrite(patientUid), state.invites.filter((i) => i.patientUid === patientUid)), cb, onError);
    },
    subscribeSharesByPatient(patientUid, cb, onError) {
      return subscribe(() => (canWrite(patientUid), state.shares.filter((s) => s.patientUid === patientUid)), cb, onError);
    },
    async createInvite(patientUid, patientName, clinicianEmail) {
      canWrite(patientUid);
      const id = nextId('i');
      state.invites.push({ id, patientUid, patientName, clinicianEmail: clinicianEmail.trim().toLowerCase(), status: 'pending', createdAt: now() });
      emit();
      return id;
    },
    async revokeInvite(invite, shares) {
      canWrite(invite.patientUid);
      state.invites = state.invites.map((i) => (i.id === invite.id ? { ...i, status: 'revoked' } : i));
      const ids = new Set(shares.filter((s) => s.inviteId === invite.id).map((s) => s.id));
      state.shares = state.shares.filter((s) => !ids.has(s.id));
      emit();
    },
    subscribePendingInvitesForClinician(email, cb, onError) {
      return subscribe(() => state.invites.filter((i) => i.clinicianEmail === email.toLowerCase() && i.status === 'pending'), cb, onError);
    },
    subscribeSharesByClinician(clinicianUid, cb, onError) {
      return subscribe(() => state.shares.filter((s) => s.clinicianUid === clinicianUid), cb, onError);
    },
    async acceptInvite(invite, clinicianUid, clinicianEmail) {
      const u = requireUser();
      if (u.uid !== clinicianUid || state.roles.get(u.uid) !== 'clinician' || !u.emailVerified || u.email !== invite.clinicianEmail) {
        throw new AppError('permission-denied');
      }
      state.shares.push({
        id: `${invite.patientUid}_${clinicianUid}`,
        patientUid: invite.patientUid,
        clinicianUid,
        clinicianEmail,
        patientName: invite.patientName,
        inviteId: invite.id,
        createdAt: now(),
      });
      state.invites = state.invites.map((i) => (i.id === invite.id ? { ...i, status: 'accepted' } : i));
      emit();
    },
    async removeShareAsClinician(share) {
      if (requireUser().uid !== share.clinicianUid) throw new AppError('permission-denied');
      state.shares = state.shares.filter((s) => s.id !== share.id);
      emit();
    },

    async deleteSyntheticData(ownerUid) {
      canWrite(ownerUid);
      const ss = list(state.sessions, ownerUid);
      const as = list(state.assessments, ownerUid);
      state.sessions.set(ownerUid, ss.filter((s) => !s.isSynthetic));
      state.assessments.set(ownerUid, as.filter((a) => !a.isSynthetic));
      emit();
      return { sessions: ss.filter((s) => s.isSynthetic).length, assessments: as.filter((a) => a.isSynthetic).length };
    },
    async deleteAllUserData(uid) {
      canWrite(uid);
      for (const s of list(state.sessions, uid)) state.samples.delete(s.id);
      state.sessions.delete(uid);
      state.assessments.delete(uid);
      state.calibrations.delete(uid);
      state.profiles.delete(uid);
      state.invites = state.invites.filter((i) => i.patientUid !== uid);
      state.shares = state.shares.filter((s) => s.patientUid !== uid && s.clinicianUid !== uid);
      emit();
    },
  };

  return {
    auth,
    data,
    mode: 'memory',
    state,
    signInAs(uid: string) {
      const acc = state.accounts.get(uid);
      if (!acc) throw new Error(`No account ${uid}`);
      current = { ...acc.user };
      emitAuth();
    },
  };
}

export function addMemoryAccount(state: MemoryState, user: AuthUser, password: string, role: Role = 'patient', withProfile = true): void {
  state.accounts.set(user.uid, { user, password });
  if (role === 'clinician') state.roles.set(user.uid, 'clinician');
  if (withProfile) {
    state.profiles.set(user.uid, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      createdAt: 0,
      reminders: { ...DEFAULT_REMINDERS },
      preferredJoint: null,
      preferredSide: null,
    });
  }
}
