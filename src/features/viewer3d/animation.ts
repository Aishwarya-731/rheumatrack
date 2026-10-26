import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Illustrative animation clock. The angle follows a smooth cosine sweep between `from` and
 * `to` over one cycle. This value is an ANIMATION PARAMETER, never a measurement.
 */
export function illustrativeAngle(from: number, to: number, phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return from + ((to - from) * (1 - Math.cos(2 * Math.PI * p))) / 2;
}

export const CYCLE_MS = 3600;

/**
 * Drives the animation phase with requestAnimationFrame. The current angle is written to a
 * ref every frame (read by the 3D scene); React state for the controls is updated at ~12 Hz.
 */
export function useIllustrativeAnimation(from: number, to: number) {
  const angleRef = useRef<number | null>(from);
  const phaseRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [display, setDisplay] = useState({ phase: 0, angle: from });
  const lastUi = useRef(0);

  const publish = useCallback(
    (force = false) => {
      const now = performance.now();
      if (!force && now - lastUi.current < 80) return;
      lastUi.current = now;
      setDisplay({ phase: phaseRef.current, angle: angleRef.current ?? from });
    },
    [from],
  );

  // Reset whenever the movement changes.
  useEffect(() => {
    phaseRef.current = 0;
    angleRef.current = illustrativeAngle(from, to, 0);
    publish(true);
    setPlaying(true);
  }, [from, to, publish]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      phaseRef.current = (phaseRef.current + dt / CYCLE_MS) % 1;
      angleRef.current = illustrativeAngle(from, to, phaseRef.current);
      publish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, from, to, publish]);

  const seek = useCallback(
    (phase: number) => {
      setPlaying(false);
      phaseRef.current = Math.max(0, Math.min(0.9999, phase));
      angleRef.current = illustrativeAngle(from, to, phaseRef.current);
      publish(true);
    },
    [from, to, publish],
  );
  const replay = useCallback(() => {
    phaseRef.current = 0;
    angleRef.current = illustrativeAngle(from, to, 0);
    publish(true);
    setPlaying(true);
  }, [from, to, publish]);

  return { angleRef, playing, setPlaying, phase: display.phase, angle: display.angle, seek, replay };
}
