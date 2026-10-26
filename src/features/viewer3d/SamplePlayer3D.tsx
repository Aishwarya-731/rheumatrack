import type { CameraControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { Joint, Movement, Side } from '@/domain/joints';
import { jointLabel } from '@/domain/joints';
import { Figure } from './Figure';
import { CameraRig, useViewerColors, ViewerCanvas } from './Scene';

/** Figure posed by an imported sample angle (the value of a recorded sample, not an animation). */
export default function SamplePlayer3D({ joint, side, movement, angleDeg, height = 320 }: { joint: Joint; side: Side; movement: Movement; angleDeg: number | null; height?: number }) {
  const colors = useViewerColors();
  const pivots = useRef(new Map<string, THREE.Object3D>());
  const controlsRef = useRef<CameraControls | null>(null);
  const angleRef = useRef<number | null>(angleDeg);
  angleRef.current = angleDeg;
  const focus = useMemo(() => ({ joint, side, movement }), [joint, side, movement]);
  return (
    <div style={{ position: 'relative' }}>
      <ViewerCanvas height={height} bg={colors.bg} floor={colors.floor} controlsRef={controlsRef} label={`3D figure posed by the imported sample angle of the ${jointLabel(joint, side).toLowerCase()}`}>
        <Figure selected={{ joint, side, movement }} angleRef={angleRef} observedRange={null} colors={colors.figure} pivotRegistry={pivots} interactive={false} />
        <CameraRig focus={focus} pivots={pivots} controlsRef={controlsRef} />
      </ViewerCanvas>
      <span className="badge badge-info overlay-badge" style={{ position: 'absolute', left: 12, top: 12 }}>
        Imported sample angle
      </span>
    </div>
  );
}
