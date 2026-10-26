import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { defaultMovement, isJoint, isMovementSupported, isSide, type Joint, type Movement, type Side } from '@/domain/joints';

/**
 * The single source of truth for the selected joint, side and movement. The body diagram,
 * the dropdowns, the side toggle and the 3D viewer all read and write this state, so every
 * selector stays synchronised.
 */
export interface Selection {
  joint: Joint;
  side: Side;
  movement: Movement;
}

interface SelectionContextValue extends Selection {
  setJoint: (j: Joint) => void;
  setSide: (s: Side) => void;
  setMovement: (m: Movement) => void;
  select: (j: Joint, s: Side, m?: Movement) => void;
}

const STORAGE_KEY = 'rt.selection';
const SelectionContext = createContext<SelectionContextValue | null>(null);

function load(): Selection {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Selection>;
      if (isJoint(v.joint) && isSide(v.side)) {
        const movement = v.movement && isMovementSupported(v.joint, v.movement) ? v.movement : defaultMovement(v.joint);
        return { joint: v.joint, side: v.side, movement };
      }
    }
  } catch {
    /* ignore */
  }
  return { joint: 'knee', side: 'right', movement: 'flexion' };
}

/** Applies a change and coerces the movement to one supported by the joint. */
export function nextSelection(prev: Selection, change: Partial<Selection>): Selection {
  const joint = change.joint ?? prev.joint;
  const side = change.side ?? prev.side;
  let movement = change.movement ?? prev.movement;
  if (!isMovementSupported(joint, movement)) movement = defaultMovement(joint);
  return { joint, side, movement };
}

export function SelectionProvider({ children, initial }: { children: ReactNode; initial?: Selection }) {
  const [sel, setSel] = useState<Selection>(() => initial ?? load());

  const update = useCallback((change: Partial<Selection>) => {
    setSel((prev) => {
      const next = nextSelection(prev, change);
      if (next.joint === prev.joint && next.side === prev.side && next.movement === prev.movement) return prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      ...sel,
      setJoint: (joint) => update({ joint }),
      setSide: (side) => update({ side }),
      setMovement: (movement) => update({ movement }),
      select: (joint, side, movement) => update(movement ? { joint, side, movement } : { joint, side }),
    }),
    [sel, update],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider');
  return ctx;
}
