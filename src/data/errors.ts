/** Maps Firebase error codes to clear, non-technical messages. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/requires-recent-login': 'For your security, enter your password again to continue.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/missing-password': 'Enter your password.',
  'permission-denied': 'You do not have permission to do this.',
  unavailable: 'The service is unavailable. Check your connection and try again.',
  'deadline-exceeded': 'The request took too long. Try again.',
  'not-found': 'The record no longer exists.',
};

export class AppError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? MESSAGES[code] ?? 'Something went wrong. Please try again.');
    this.code = code;
    this.name = 'AppError';
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    const code = (e as { code: string }).code.replace(/^firestore\//, '');
    return new AppError(code);
  }
  if (e instanceof Error) return new AppError('unknown', e.message);
  return new AppError('unknown');
}
