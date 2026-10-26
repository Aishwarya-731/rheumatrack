import type { Joint, Movement, Side } from '@/domain/joints';
import type {
  AngleSample,
  CalibrationRecord,
  DataSource,
  MovementMetrics,
  ReminderSettings,
  Role,
  ShareGrant,
  ShareInvite,
  SymptomAssessment,
  UserProfile,
  MovementSession,
  CalibrationStatus,
} from '@/domain/types';

/**
 * Application service interfaces. The UI depends only on these; the Firestore implementation
 * lives in ./firestore and an in-memory implementation (for tests) in ./memory.
 */

export type Unsubscribe = () => void;

export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

export interface AuthService {
  /** Calls back with the current user (or null) now and on every change. */
  onChange(cb: (user: AuthUser | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  sendEmailVerification(): Promise<void>;
  /** Re-reads the user (e.g. after verifying the email in another tab). */
  reload(): Promise<AuthUser | null>;
  updateDisplayName(name: string): Promise<void>;
  /** Re-authenticates with the password, then deletes the auth account. */
  deleteAccount(password: string): Promise<void>;
  reauthenticate(password: string): Promise<void>;
}

export interface NewSessionInput {
  joint: Joint;
  side: Side;
  movement: Movement;
  source: DataSource;
  isSynthetic: boolean;
  sourceFileName: string | null;
  sourceFormat: 'csv' | 'json' | 'generated';
  metrics: MovementMetrics;
  calibrationId: string | null;
  calibrationStatus: CalibrationStatus;
  notes: string;
}

export interface AssessmentInput {
  joint: Joint;
  side: Side;
  pain: number;
  stiffness: number;
  discomfort: number;
  durationMinutes: number | null;
  notes: string;
  assessedAt: number;
}

export type NewCalibrationInput = Omit<CalibrationRecord, 'id' | 'ownerUid' | 'createdAt' | 'schemaVersion'>;

export interface ProfileInput {
  displayName: string;
  email: string;
  reminders: ReminderSettings;
}

export interface DataService {
  // Profile and role
  getProfile(uid: string): Promise<UserProfile | null>;
  createProfile(uid: string, input: ProfileInput): Promise<void>;
  updateProfile(uid: string, patch: Partial<Pick<UserProfile, 'displayName' | 'reminders' | 'preferredJoint' | 'preferredSide'>>): Promise<void>;
  subscribeProfile(uid: string, cb: (p: UserProfile | null) => void, onError: (e: Error) => void): Unsubscribe;
  /** Role as recorded server-side. Missing role document = patient. */
  getRole(uid: string): Promise<Role>;

  // Movement sessions (ownerUid = the patient whose records these are)
  subscribeSessions(ownerUid: string, cb: (s: MovementSession[]) => void, onError: (e: Error) => void): Unsubscribe;
  createSession(ownerUid: string, input: NewSessionInput, samples: readonly AngleSample[]): Promise<string>;
  getSessionSamples(ownerUid: string, session: Pick<MovementSession, 'id' | 'chunkCount'>): Promise<AngleSample[]>;
  updateSessionNotes(ownerUid: string, sessionId: string, notes: string): Promise<void>;
  deleteSession(ownerUid: string, session: Pick<MovementSession, 'id' | 'chunkCount'>): Promise<void>;

  // Symptom assessments
  subscribeAssessments(ownerUid: string, cb: (a: SymptomAssessment[]) => void, onError: (e: Error) => void): Unsubscribe;
  createAssessment(ownerUid: string, input: AssessmentInput, isSynthetic?: boolean): Promise<string>;
  updateAssessment(ownerUid: string, id: string, input: AssessmentInput): Promise<void>;
  deleteAssessment(ownerUid: string, id: string): Promise<void>;

  // Calibration
  subscribeCalibrations(ownerUid: string, cb: (c: CalibrationRecord[]) => void, onError: (e: Error) => void): Unsubscribe;
  createCalibration(ownerUid: string, input: NewCalibrationInput): Promise<string>;
  deleteCalibration(ownerUid: string, id: string): Promise<void>;

  // Sharing — patient side
  subscribeInvitesByPatient(patientUid: string, cb: (i: ShareInvite[]) => void, onError: (e: Error) => void): Unsubscribe;
  subscribeSharesByPatient(patientUid: string, cb: (s: ShareGrant[]) => void, onError: (e: Error) => void): Unsubscribe;
  createInvite(patientUid: string, patientName: string, clinicianEmail: string): Promise<string>;
  /** Revokes an invite and removes any share created from it. */
  revokeInvite(invite: ShareInvite, shares: readonly ShareGrant[]): Promise<void>;

  // Sharing — clinician side
  subscribePendingInvitesForClinician(email: string, cb: (i: ShareInvite[]) => void, onError: (e: Error) => void): Unsubscribe;
  subscribeSharesByClinician(clinicianUid: string, cb: (s: ShareGrant[]) => void, onError: (e: Error) => void): Unsubscribe;
  acceptInvite(invite: ShareInvite, clinicianUid: string, clinicianEmail: string): Promise<void>;
  removeShareAsClinician(share: ShareGrant): Promise<void>;

  // Bulk operations
  deleteSyntheticData(ownerUid: string): Promise<{ sessions: number; assessments: number }>;
  /** Deletes every record owned by the user (not the auth account). */
  deleteAllUserData(uid: string): Promise<void>;
}

export interface Services {
  auth: AuthService;
  data: DataService;
  mode: 'emulator' | 'project' | 'memory';
}

/** User-facing message for an unknown error (Firebase codes are mapped in ./errors). */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
