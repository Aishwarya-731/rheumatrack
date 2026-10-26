import { useCallback, useState } from 'react';

/** State persisted to localStorage; falls back to memory if storage is unavailable. */
export function useLocalStorageState<T>(key: string, initial: T, validate: (v: unknown) => v is T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set];
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
