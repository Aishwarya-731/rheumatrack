import type { CameraControls } from '@react-three/drei';
import { Maximize2, Pause, Play, RotateCcw, ScanSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import { useSelection } from '@/app/providers/SelectionProvider';
import { Segmented } from '@/components/ui/Fields';
import { fmtDeg } from '@/domain/format';
import { getMovement, jointLabel, movementLabel, type Joint, type Side } from '@/domain/joints';
import type { MovementSession } from '@/domain/types';
import { useIllustrativeAnimation } from './animation';
import { Figure } from './Figure';
import { CameraRig, FULL_BODY_VIEW, useViewerColors, ViewerCanvas } from './Scene';

interface BodyViewer3DProps {
  /** Latest session for the selected joint/side/movement, if any (drives the observed-range arc). */
  latestSession: MovementSession | null;
  height?: number;
  /** Start zoomed in on the selected joint. */
  initialFocus?: boolean;
}

type Mode = 'illustrative' | 'observed';

/**
 * Interactive full-body viewer. Clicking a joint selects it (shared selection), zooms the
 * camera to it and plays that joint's illustrative movement. When imported data exists for the
 * selection, the observed min–max range is drawn as an arc at the joint.
 */
export default function BodyViewer3D({ latestSession, height = 520, initialFocus = false }: BodyViewer3DProps) {
  const { joint, side, movement, select } = useSelection();
  const def = getMovement(joint, movement);
  const anim = useIllustrativeAnimation(def?.animation.from ?? 0, def?.animation.to ?? 0);
  const colors = useViewerColors();
  const pivots = useRef(new Map<string, THREE.Object3D>());
  const controlsRef = useRef<CameraControls | null>(null);
  const [focused, setFocused] = useState<boolean>(initialFocus);
  const [mode, setMode] = useState<Mode>('illustrative');
  const staticAngle = useRef<number | null>(null);

  // Selecting a joint anywhere (3D model, body diagram, dropdown, side toggle) zooms to it.
  const firstSelection = useRef(true);
  useEffect(() => {
    if (firstSelection.current) {
      firstSelection.current = false;
      return;
    }
    setFocused(true);
  }, [joint, side]);
  // While zoomed in, the camera follows the shared selection.
  const focus = useMemo(() => (focused ? { joint, side, movement } : null), [focused, joint, side, movement]);

  // Esc returns to the full body view.
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocused(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused]);

  const observed = latestSession ? { minDeg: latestSession.metrics.minDeg, maxDeg: latestSession.metrics.maxDeg } : null;
  const hasObserved = observed !== null;
  useEffect(() => {
    if (!hasObserved) setMode('illustrative');
  }, [hasObserved]);

  // In "observed range" mode the figure rests at the observed maximum (a recorded value).
  staticAngle.current = observed ? observed.maxDeg : null;
  const angleRef = mode === 'illustrative' ? anim.angleRef : staticAngle;

  const handleSelect = (j: Joint, s: Side) => {
    select(j, s);
    setFocused(true);
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <ViewerCanvas
          height={height}
          bg={colors.bg}
          floor={colors.floor}
          controlsRef={controlsRef}
          label={`3D body model. Selected: ${jointLabel(joint, side)}, ${movementLabel(movement).toLowerCase()}. Click a joint to select it and zoom in.`}
        >
          <Figure
            selected={{ joint, side, movement }}
            angleRef={angleRef}
            observedRange={mode === 'observed' ? observed : null}
            colors={colors.figure}
            onSelectJoint={handleSelect}
            pivotRegistry={pivots}
          />
          <CameraRig focus={focus} pivots={pivots} controlsRef={controlsRef} />
        </ViewerCanvas>
        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: 'none' }}>
          <span className="badge badge-accent overlay-badge">{jointLabel(joint, side)} · {movementLabel(movement)}</span>
          <span className={`badge overlay-badge ${mode === 'illustrative' ? 'badge-violet' : 'badge-info'}`}>{mode === 'illustrative' ? 'Illustrative animation' : 'Imported data — observed range'}</span>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 8 }}>
          {focused ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFocused(false)} title="Back to full body (Esc)">
              <Maximize2 aria-hidden /> Full body
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFocused(true)}>
              <ScanSearch aria-hidden /> Zoom to joint
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            style={{ width: 36, height: 36 }}
            aria-label="Reset camera"
            title="Reset camera"
            onClick={() => {
              setFocused(false);
              void controlsRef.current?.setLookAt(...FULL_BODY_VIEW.position, ...FULL_BODY_VIEW.target, true);
            }}
          >
            <RotateCcw aria-hidden />
          </button>
        </div>
        {observed && mode === 'observed' && (
          <div className="chart-tooltip" style={{ position: 'absolute', left: 12, bottom: 12, pointerEvents: 'none' }}>
            Arc: observed {fmtDeg(observed.minDeg)} to {fmtDeg(observed.maxDeg)} (latest session). Figure posed at the observed maximum.
          </div>
        )}
      </div>

      <div className="row row-between" style={{ alignItems: 'center' }}>
        <Segmented<Mode>
          label="Viewer mode"
          value={mode}
          onChange={setMode}
          options={observed ? [{ value: 'illustrative', label: 'Illustrative animation' }, { value: 'observed', label: 'Observed range' }] : [{ value: 'illustrative', label: 'Illustrative animation' }]}
        />
        <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
          Drag to rotate · scroll to zoom · click a joint to select
        </span>
      </div>

      {mode === 'illustrative' && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {anim.playing ? (
              <button type="button" className="icon-btn" onClick={() => anim.setPlaying(false)} aria-label="Pause animation">
                <Pause aria-hidden />
              </button>
            ) : (
              <button type="button" className="icon-btn" onClick={() => anim.setPlaying(true)} aria-label="Play animation">
                <Play aria-hidden />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={anim.replay} aria-label="Replay animation">
              <RotateCcw aria-hidden />
            </button>
            <input
              type="range"
              className="range"
              min={0}
              max={1000}
              value={Math.round(anim.phase * 1000)}
              onChange={(e) => anim.seek(Number(e.target.value) / 1000)}
              aria-label="Animation timeline"
              aria-valuetext={`Illustrative angle ${anim.angle.toFixed(0)} degrees`}
              style={{ ['--pct' as string]: `${anim.phase * 100}%`, flex: 1 }}
            />
            <span className="num" style={{ minWidth: 150, textAlign: 'right' }} data-testid="illustrative-angle">
              Animation angle: <strong>{fmtDeg(anim.angle, 0)}</strong>
            </span>
          </div>
          <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
            The animation angle is an illustrative parameter (sweep {fmtDeg(def?.animation.from ?? 0, 0)} → {fmtDeg(def?.animation.to ?? 0, 0)}), not a measurement or a reference range.
          </p>
        </div>
      )}
    </div>
  );
}
