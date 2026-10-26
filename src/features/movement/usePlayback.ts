import { useCallback, useEffect, useRef, useState } from 'react';
import type { AngleSample } from '@/domain/types';

/** Index of the last sample with t ≤ time (binary search). */
export function sampleIndexAt(samples: readonly AngleSample[], time: number): number {
  let lo = 0;
  let hi = samples.length - 1;
  if (hi < 0) return -1;
  if (time <= (samples[0] as AngleSample).t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((samples[mid] as AngleSample).t <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Real-time playback over imported samples. The value exposed is always an actual sample
 * (no interpolation), so the "imported sample angle" shown is a recorded value.
 */
export function usePlayback(samples: readonly AngleSample[] | null, speed = 1) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const anchor = useRef<{ wall: number; t: number } | null>(null);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    anchor.current = null;
  }, []);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    stop();
  }, [samples, stop]);

  useEffect(() => {
    if (!playing || !samples || samples.length < 2) return;
    const startT = (samples[index] as AngleSample).t;
    anchor.current = { wall: performance.now(), t: startT };
    const last = (samples[samples.length - 1] as AngleSample).t;
    const tick = (now: number) => {
      const a = anchor.current;
      if (!a) return;
      const t = a.t + (now - a.wall) * speed;
      if (t >= last) {
        setIndex(samples.length - 1);
        setPlaying(false);
        stop();
        return;
      }
      setIndex(sampleIndexAt(samples, t));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return stop;
    // index intentionally omitted: playback continues from where play was pressed.
  }, [playing, samples, speed, stop]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(() => {
    if (!samples || samples.length < 2) return;
    setIndex((i) => (i >= samples.length - 1 ? 0 : i));
    setPlaying(true);
  }, [samples]);
  const pause = useCallback(() => setPlaying(false), []);
  const seek = useCallback(
    (i: number) => {
      if (!samples) return;
      setPlaying(false);
      setIndex(Math.max(0, Math.min(samples.length - 1, Math.round(i))));
    },
    [samples],
  );
  const replay = useCallback(() => {
    setIndex(0);
    setPlaying(true);
  }, []);

  const current = samples && samples.length > 0 ? (samples[Math.min(index, samples.length - 1)] as AngleSample) : null;
  return { index, current, playing, play, pause, seek, replay };
}
