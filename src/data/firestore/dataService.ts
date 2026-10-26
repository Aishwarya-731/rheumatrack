import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import type { Joint, Movement, Side } from '@/domain/joints';
import { DEFAULT_REMINDERS } from '@/domain/reminders';
import type {
  AngleSample,
  CalibrationRecord,
  MovementSession,
  ReminderSettings,
  Role,
  ShareGrant,
  ShareInvite,
  SymptomAssessment,
  UserProfile,
} from '@/domain/types';
import { toAppError } from '../errors';
import type { DataService, Unsubscribe } from '../services';

/** Samples per chunk document (well under Firestore's 1 MiB document limit). */
export const CHUNK_SIZE = 5000;
/** Firestore allows 500 writes per batch; stay below it. */
const BATCH_LIMIT = 450;
/** Most recent records loaded per collection. */
const LIST_LIMIT = 1000;

const SNAP = { serverTimestamps: 'estimate' } as const;

function ms(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

function msOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : ms(v);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function mapSession(ownerUid: string, d: QueryDocumentSnapshot<DocumentData>): MovementSession {
  const x = d.data(SNAP);
  return {
    id: d.id,
    ownerUid,
    joint: x.joint as Joint,
    side: x.side as Side,
    movement: x.movement as Movement,
    source: x.source,
    isSynthetic: Boolean(x.isSynthetic),
    sourceFileName: (x.sourceFileName as string | null) ?? null,
    sourceFormat: x.sourceFormat,
    startedAt: ms(x.startedAt),
    endedAt: ms(x.endedAt),
    createdAt: ms(x.createdAt),
    metrics: x.metrics,
    calibrationId: (x.calibrationId as string | null) ?? null,
    calibrationStatus: x.calibrationStatus,
    notes: str(x.notes),
    chunkCount: Number(x.chunkCount ?? 0),
    schemaVersion: 1,
  };
}

function mapAssessment(ownerUid: string, d: QueryDocumentSnapshot<DocumentData>): SymptomAssessment {
  const x = d.data(SNAP);
  return {
    id: d.id,
    ownerUid,
    joint: x.joint as Joint,
    side: x.side as Side,
    pain: Number(x.pain),
    stiffness: Number(x.stiffness),
    discomfort: Number(x.discomfort),
    durationMinutes: x.durationMinutes === null || x.durationMinutes === undefined ? null : Number(x.durationMinutes),
    notes: str(x.notes),
    assessedAt: ms(x.assessedAt),
    createdAt: ms(x.createdAt),
    updatedAt: msOrNull(x.updatedAt),
    isSynthetic: Boolean(x.isSynthetic),
    schemaVersion: 1,
  };
}

function mapCalibration(ownerUid: string, d: QueryDocumentSnapshot<DocumentData>): CalibrationRecord {
  const x = d.data(SNAP);
  return {
    id: d.id,
    ownerUid,
    joint: x.joint,
    side: x.side,
    movement: x.movement,
    inputSource: 'static-reference-file',
    sourceFileName: str(x.sourceFileName),
    outcome: x.outcome,
    referenceAngleDeg: (x.referenceAngleDeg as number | null) ?? null,
    holdSdDeg: (x.holdSdDeg as number | null) ?? null,
    holdDurationMs: (x.holdDurationMs as number | null) ?? null,
    sampleCount: Number(x.sampleCount ?? 0),
    validationMessages: Array.isArray(x.validationMessages) ? (x.validationMessages as string[]) : [],
    config: x.config,
    createdAt: ms(x.createdAt),
    schemaVersion: 1,
  };
}

function mapProfile(d: DocumentSnapshot<DocumentData>): UserProfile | null {
  if (!d.exists()) return null;
  const x = d.data(SNAP);
  const r = (x.reminders ?? {}) as Partial<ReminderSettings>;
  return {
    uid: d.id,
    displayName: str(x.displayName),
    email: str(x.email),
    createdAt: ms(x.createdAt),
    reminders: {
      enabled: Boolean(r.enabled),
      time: str(r.time, DEFAULT_REMINDERS.time),
      days: Array.isArray(r.days) ? r.days : DEFAULT_REMINDERS.days,
      timezone: str(r.timezone, DEFAULT_REMINDERS.timezone),
    },
    preferredJoint: (x.preferredJoint as Joint | null) ?? null,
    preferredSide: (x.preferredSide as Side | null) ?? null,
  };
}

function mapInvite(d: QueryDocumentSnapshot<DocumentData>): ShareInvite {
  const x = d.data(SNAP);
  return {
    id: d.id,
    patientUid: str(x.patientUid),
    patientName: str(x.patientName),
    clinicianEmail: str(x.clinicianEmail),
    status: x.status,
    createdAt: ms(x.createdAt),
  };
}

function mapShare(d: QueryDocumentSnapshot<DocumentData>): ShareGrant {
  const x = d.data(SNAP);
  return {
    id: d.id,
    patientUid: str(x.patientUid),
    clinicianUid: str(x.clinicianUid),
    clinicianEmail: str(x.clinicianEmail),
    patientName: str(x.patientName),
    inviteId: str(x.inviteId),
    createdAt: ms(x.createdAt),
  };
}

export function shareId(patientUid: string, clinicianUid: string): string {
  return `${patientUid}_${clinicianUid}`;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toAppError(e);
  }
}

/** Commits writes in batches below the Firestore limit. */
async function commitInBatches(db: Firestore, ops: Array<(b: WriteBatch) => void>): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch);
    await batch.commit();
  }
}

export function createFirestoreDataService(db: Firestore): DataService {
  const userDoc = (uid: string) => doc(db, 'users', uid);
  const sessionsCol = (uid: string) => collection(db, 'users', uid, 'sessions');
  const chunksCol = (uid: string, sid: string) => collection(db, 'users', uid, 'sessions', sid, 'chunks');
  const assessmentsCol = (uid: string) => collection(db, 'users', uid, 'assessments');
  const calibrationsCol = (uid: string) => collection(db, 'users', uid, 'calibrations');
  const invitesCol = collection(db, 'invites');
  const sharesCol = collection(db, 'shares');

  const listen = <T>(
    q: Query<DocumentData>,
    map: (d: QueryDocumentSnapshot<DocumentData>) => T,
    cb: (items: T[]) => void,
    onError: (e: Error) => void,
  ): Unsubscribe =>
    onSnapshot(
      q,
      (snap) => cb(snap.docs.map(map)),
      (e) => onError(toAppError(e)),
    );

  const service: DataService = {
    getProfile: (uid) => run(async () => mapProfile(await getDoc(userDoc(uid)))),

    createProfile: (uid, input) =>
      run(() =>
        setDoc(userDoc(uid), {
          displayName: input.displayName,
          email: input.email.toLowerCase(),
          createdAt: serverTimestamp(),
          reminders: input.reminders,
          preferredJoint: null,
          preferredSide: null,
          schemaVersion: 1,
        }),
      ),

    updateProfile: (uid, patch) => run(() => updateDoc(userDoc(uid), { ...patch, updatedAt: serverTimestamp() })),

    subscribeProfile: (uid, cb, onError) =>
      onSnapshot(
        userDoc(uid),
        (d) => cb(mapProfile(d)),
        (e) => onError(toAppError(e)),
      ),

    getRole: (uid) =>
      run(async () => {
        const d = await getDoc(doc(db, 'roles', uid));
        const role = d.exists() ? (d.data().role as unknown) : null;
        return (role === 'clinician' ? 'clinician' : 'patient') as Role;
      }),

    subscribeSessions: (ownerUid, cb, onError) =>
      listen(query(sessionsCol(ownerUid), orderBy('startedAt', 'desc'), limit(LIST_LIMIT)), (d) => mapSession(ownerUid, d), cb, onError),

    createSession: (ownerUid, input, samples) =>
      run(async () => {
        if (samples.length < 2) throw new Error('A session needs at least two samples.');
        const ref = doc(sessionsCol(ownerUid));
        const chunkCount = Math.ceil(samples.length / CHUNK_SIZE);
        const first = samples[0] as AngleSample;
        const last = samples[samples.length - 1] as AngleSample;
        const ops: Array<(b: WriteBatch) => void> = [];
        for (let i = 0; i < chunkCount; i++) {
          const part = samples.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          ops.push((b) =>
            b.set(doc(chunksCol(ownerUid, ref.id), String(i).padStart(4, '0')), {
              index: i,
              t: part.map((s) => s.t),
              a: part.map((s) => s.angleDeg),
            }),
          );
        }
        // The session document is written last, so a session never appears without its samples.
        ops.push((b) =>
          b.set(ref, {
            joint: input.joint,
            side: input.side,
            movement: input.movement,
            source: input.source,
            isSynthetic: input.isSynthetic,
            sourceFileName: input.sourceFileName,
            sourceFormat: input.sourceFormat,
            startedAt: Timestamp.fromMillis(first.t),
            endedAt: Timestamp.fromMillis(last.t),
            createdAt: serverTimestamp(),
            createdBy: ownerUid,
            metrics: input.metrics,
            calibrationId: input.calibrationId,
            calibrationStatus: input.calibrationStatus,
            notes: input.notes,
            chunkCount,
            schemaVersion: 1,
          }),
        );
        await commitInBatches(db, ops);
        return ref.id;
      }),

    getSessionSamples: (ownerUid, session) =>
      run(async () => {
        const snap = await getDocs(query(chunksCol(ownerUid, session.id), orderBy('index', 'asc')));
        if (snap.size !== session.chunkCount) {
          throw new Error(`Sample data is incomplete (${snap.size} of ${session.chunkCount} parts found).`);
        }
        const out: AngleSample[] = [];
        for (const d of snap.docs) {
          const x = d.data() as { t: number[]; a: number[] };
          for (let i = 0; i < x.t.length; i++) out.push({ t: x.t[i] as number, angleDeg: x.a[i] as number });
        }
        return out;
      }),

    updateSessionNotes: (ownerUid, sessionId, notes) =>
      run(() => updateDoc(doc(sessionsCol(ownerUid), sessionId), { notes, updatedAt: serverTimestamp() })),

    deleteSession: (ownerUid, session) =>
      run(async () => {
        const chunks = await getDocs(chunksCol(ownerUid, session.id));
        const ops: Array<(b: WriteBatch) => void> = chunks.docs.map((d) => (b) => b.delete(d.ref));
        ops.push((b) => b.delete(doc(sessionsCol(ownerUid), session.id)));
        await commitInBatches(db, ops);
      }),

    subscribeAssessments: (ownerUid, cb, onError) =>
      listen(query(assessmentsCol(ownerUid), orderBy('assessedAt', 'desc'), limit(LIST_LIMIT)), (d) => mapAssessment(ownerUid, d), cb, onError),

    createAssessment: (ownerUid, input, isSynthetic = false) =>
      run(async () => {
        const ref = doc(assessmentsCol(ownerUid));
        await setDoc(ref, {
          ...input,
          assessedAt: Timestamp.fromMillis(input.assessedAt),
          createdAt: serverTimestamp(),
          updatedAt: null,
          createdBy: ownerUid,
          isSynthetic,
          schemaVersion: 1,
        });
        return ref.id;
      }),

    updateAssessment: (ownerUid, id, input) =>
      run(() =>
        updateDoc(doc(assessmentsCol(ownerUid), id), {
          ...input,
          assessedAt: Timestamp.fromMillis(input.assessedAt),
          updatedAt: serverTimestamp(),
        }),
      ),

    deleteAssessment: (ownerUid, id) => run(async () => void (await writeBatchDelete(db, [doc(assessmentsCol(ownerUid), id)]))),

    subscribeCalibrations: (ownerUid, cb, onError) =>
      listen(query(calibrationsCol(ownerUid), orderBy('createdAt', 'desc'), limit(LIST_LIMIT)), (d) => mapCalibration(ownerUid, d), cb, onError),

    createCalibration: (ownerUid, input) =>
      run(async () => {
        const ref = doc(calibrationsCol(ownerUid));
        await setDoc(ref, { ...input, createdAt: serverTimestamp(), createdBy: ownerUid, schemaVersion: 1 });
        return ref.id;
      }),

    deleteCalibration: (ownerUid, id) => run(async () => void (await writeBatchDelete(db, [doc(calibrationsCol(ownerUid), id)]))),

    subscribeInvitesByPatient: (patientUid, cb, onError) =>
      listen(query(invitesCol, where('patientUid', '==', patientUid)), mapInvite, cb, onError),

    subscribeSharesByPatient: (patientUid, cb, onError) => listen(query(sharesCol, where('patientUid', '==', patientUid)), mapShare, cb, onError),

    createInvite: (patientUid, patientName, clinicianEmail) =>
      run(async () => {
        const ref = doc(invitesCol);
        await setDoc(ref, {
          patientUid,
          patientName,
          clinicianEmail: clinicianEmail.trim().toLowerCase(),
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        return ref.id;
      }),

    revokeInvite: (invite, shares) =>
      run(async () => {
        const batch = writeBatch(db);
        batch.update(doc(invitesCol, invite.id), { status: 'revoked' });
        for (const s of shares) if (s.inviteId === invite.id) batch.delete(doc(sharesCol, s.id));
        await batch.commit();
      }),

    subscribePendingInvitesForClinician: (email, cb, onError) =>
      listen(
        query(invitesCol, where('clinicianEmail', '==', email.trim().toLowerCase()), where('status', '==', 'pending')),
        mapInvite,
        cb,
        onError,
      ),

    subscribeSharesByClinician: (clinicianUid, cb, onError) =>
      listen(query(sharesCol, where('clinicianUid', '==', clinicianUid)), mapShare, cb, onError),

    acceptInvite: (invite, clinicianUid, clinicianEmail) =>
      run(async () => {
        const batch = writeBatch(db);
        batch.set(doc(sharesCol, shareId(invite.patientUid, clinicianUid)), {
          patientUid: invite.patientUid,
          clinicianUid,
          clinicianEmail: clinicianEmail.toLowerCase(),
          patientName: invite.patientName,
          inviteId: invite.id,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(invitesCol, invite.id), { status: 'accepted' });
        await batch.commit();
      }),

    removeShareAsClinician: (share) => run(async () => void (await writeBatchDelete(db, [doc(sharesCol, share.id)]))),

    deleteSyntheticData: (ownerUid) =>
      run(async () => {
        const sessions = await getDocs(query(sessionsCol(ownerUid), where('isSynthetic', '==', true)));
        const assessments = await getDocs(query(assessmentsCol(ownerUid), where('isSynthetic', '==', true)));
        const ops: Array<(b: WriteBatch) => void> = [];
        for (const s of sessions.docs) {
          const chunks = await getDocs(chunksCol(ownerUid, s.id));
          for (const c of chunks.docs) ops.push((b) => b.delete(c.ref));
          ops.push((b) => b.delete(s.ref));
        }
        for (const a of assessments.docs) ops.push((b) => b.delete(a.ref));
        await commitInBatches(db, ops);
        return { sessions: sessions.size, assessments: assessments.size };
      }),

    deleteAllUserData: (uid) =>
      run(async () => {
        const ops: Array<(b: WriteBatch) => void> = [];
        const sessions = await getDocs(sessionsCol(uid));
        for (const s of sessions.docs) {
          const chunks = await getDocs(chunksCol(uid, s.id));
          for (const c of chunks.docs) ops.push((b) => b.delete(c.ref));
          ops.push((b) => b.delete(s.ref));
        }
        for (const a of (await getDocs(assessmentsCol(uid))).docs) ops.push((b) => b.delete(a.ref));
        for (const c of (await getDocs(calibrationsCol(uid))).docs) ops.push((b) => b.delete(c.ref));
        for (const s of (await getDocs(query(sharesCol, where('patientUid', '==', uid)))).docs) ops.push((b) => b.delete(s.ref));
        for (const i of (await getDocs(query(invitesCol, where('patientUid', '==', uid)))).docs) ops.push((b) => b.delete(i.ref));
        for (const s of (await getDocs(query(sharesCol, where('clinicianUid', '==', uid)))).docs) ops.push((b) => b.delete(s.ref));
        ops.push((b) => b.delete(userDoc(uid)));
        await commitInBatches(db, ops);
      }),
  };
  return service;
}

async function writeBatchDelete(db: Firestore, refs: DocumentReference<DocumentData>[]): Promise<void> {
  const b = writeBatch(db);
  for (const r of refs) b.delete(r);
  await b.commit();
}
