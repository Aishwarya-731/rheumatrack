import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CalibrationRecord, MovementSession, SymptomAssessment } from '@/domain/types';
import { useServices } from './ServicesProvider';

export interface RecordsState {
  ownerUid: string;
  sessions: MovementSession[];
  assessments: SymptomAssessment[];
  calibrations: CalibrationRecord[];
  loading: boolean;
  error: string | null;
  /** True when the viewer is not the owner (clinician view) — all editing is disabled. */
  readOnly: boolean;
  /** Route prefix for links to these records ('' for own records). */
  basePath: string;
}

/** Live subscription to one person's records (own records, or a patient who shared with a clinician). */
export function useRecordsSubscription(ownerUid: string, readOnly: boolean, basePath: string): RecordsState {
  const { data } = useServices();
  const [sessions, setSessions] = useState<MovementSession[] | null>(null);
  const [assessments, setAssessments] = useState<SymptomAssessment[] | null>(null);
  const [calibrations, setCalibrations] = useState<CalibrationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions(null);
    setAssessments(null);
    setCalibrations(null);
    setError(null);
    const onError = (e: Error) => setError(e.message);
    const u1 = data.subscribeSessions(ownerUid, setSessions, onError);
    const u2 = data.subscribeAssessments(ownerUid, setAssessments, onError);
    const u3 = data.subscribeCalibrations(ownerUid, setCalibrations, onError);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [data, ownerUid]);

  return {
    ownerUid,
    sessions: sessions ?? [],
    assessments: assessments ?? [],
    calibrations: calibrations ?? [],
    loading: error === null && (sessions === null || assessments === null || calibrations === null),
    error,
    readOnly,
    basePath,
  };
}

const RecordsContext = createContext<RecordsState | null>(null);

export function RecordsProvider({
  ownerUid,
  readOnly = false,
  basePath = '',
  children,
}: {
  ownerUid: string;
  readOnly?: boolean;
  basePath?: string;
  children: ReactNode;
}) {
  const state = useRecordsSubscription(ownerUid, readOnly, basePath);
  return <RecordsContext.Provider value={state}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsState {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error('useRecords must be used inside RecordsProvider');
  return ctx;
}
