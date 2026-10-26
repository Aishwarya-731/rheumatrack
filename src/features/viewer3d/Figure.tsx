import { Html, Line } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { JOINTS, jointLabel, SIDES, type Joint, type Movement, type Side } from '@/domain/joints';
import { arcLinePoints, arcSector, taperedLimb, torsoGeometry } from './geometry';
import { arcRadius, JOINT_RADIUS, neutralDirection, OFFSETS, PELVIS_Y, poseRotation, rotateVector, SEGMENTS, sideSign } from './rig';

export interface ViewerColors {
  body: string;
  jointIdle: string;
  accent: string;
  arc: string;
}

export interface FigureProps {
  selected: { joint: Joint; side: Side; movement: Movement } | null;
  /** Called every frame; returns the current angle (degrees) for the selected joint, or null for neutral. */
  angleRef: RefObject<number | null>;
  /** Observed min/max of imported data for the selected joint (drawn as an arc), or null. */
  observedRange: { minDeg: number; maxDeg: number } | null;
  colors: ViewerColors;
  onSelectJoint?: (joint: Joint, side: Side) => void;
  /** Receives the pivot objects so the camera can frame a joint. */
  pivotRegistry?: RefObject<Map<string, THREE.Object3D>>;
  interactive?: boolean;
}

const key = (j: Joint, s: Side) => `${j}:${s}`;

/** Which pivots move a joint's distal segments (for highlighting the moving part). */
const DISTAL: Record<Joint, Joint[]> = {
  shoulder: ['shoulder', 'elbow', 'wrist'],
  elbow: ['elbow', 'wrist'],
  wrist: ['wrist'],
  hip: ['hip', 'knee', 'ankle'],
  knee: ['knee', 'ankle'],
  ankle: ['ankle'],
};

export function Figure({ selected, angleRef, observedRange, colors, onSelectJoint, pivotRegistry, interactive = true }: FigureProps) {
  const pivots = useRef(new Map<string, THREE.Group>());
  const [hovered, setHovered] = useState<string | null>(null);

  const geos = useMemo(
    () => ({
      upperArm: taperedLimb(SEGMENTS.upperArm.length, ...SEGMENTS.upperArm.radii),
      forearm: taperedLimb(SEGMENTS.forearm.length, ...SEGMENTS.forearm.radii),
      thigh: taperedLimb(SEGMENTS.thigh.length, ...SEGMENTS.thigh.radii),
      shin: taperedLimb(SEGMENTS.shin.length, ...SEGMENTS.shin.radii),
      torso: torsoGeometry(),
      sphere: new THREE.SphereGeometry(1, 48, 32),
      neck: new THREE.CylinderGeometry(0.046, 0.052, 0.1, 32),
    }),
    [],
  );
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const bodyMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: colors.body, roughness: 0.42, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenRoughness: 0.6 }),
    [colors.body],
  );
  const activeMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: colors.body, roughness: 0.4, clearcoat: 0.4, emissive: new THREE.Color(colors.accent), emissiveIntensity: 0.28 }),
    [colors.body, colors.accent],
  );
  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({ color: colors.jointIdle, roughness: 0.35, metalness: 0.15 }), [colors.jointIdle]);
  const jointHoverMat = useMemo(() => new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.35, emissive: new THREE.Color(colors.accent), emissiveIntensity: 0.25 }), [colors.accent]);
  const jointActiveMat = useMemo(() => new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.25, emissive: new THREE.Color(colors.accent), emissiveIntensity: 0.9 }), [colors.accent]);
  useEffect(() => () => [bodyMat, activeMat, jointMat, jointHoverMat, jointActiveMat].forEach((m) => m.dispose()), [bodyMat, activeMat, jointMat, jointHoverMat, jointActiveMat]);

  // Apply the pose every frame: only the selected joint moves; all others are neutral.
  useFrame(() => {
    for (const j of JOINTS) {
      for (const s of SIDES) {
        const g = pivots.current.get(key(j, s));
        if (!g) continue;
        if (selected && selected.joint === j && selected.side === s && angleRef.current !== null) {
          const [x, y, z] = poseRotation(j, selected.movement, s, angleRef.current);
          g.rotation.set(x, y, z);
        } else {
          g.rotation.set(0, 0, 0);
        }
      }
    }
  });

  const isMoving = (j: Joint, s: Side) => selected !== null && selected.side === s && DISTAL[selected.joint].includes(j);
  const segMat = (j: Joint, s: Side) => (isMoving(j, s) ? activeMat : bodyMat);

  const registerPivot = (j: Joint, s: Side) => (g: THREE.Group | null) => {
    if (g) {
      pivots.current.set(key(j, s), g);
      pivotRegistry?.current.set(key(j, s), g);
    } else {
      pivots.current.delete(key(j, s));
      pivotRegistry?.current.delete(key(j, s));
    }
  };

  const jointMarker = (j: Joint, s: Side) => {
    const k = key(j, s);
    const isSel = selected?.joint === j && selected.side === s;
    const r = JOINT_RADIUS[j] * (isSel ? 1.12 : 1);
    return (
      <mesh
        geometry={geos.sphere}
        scale={[r, r, r]}
        material={isSel ? jointActiveMat : hovered === k ? jointHoverMat : jointMat}
        castShadow
        onClick={
          interactive
            ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onSelectJoint?.(j, s);
              }
            : undefined
        }
        onPointerOver={
          interactive
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHovered(k);
                document.body.style.cursor = 'pointer';
              }
            : undefined
        }
        onPointerOut={
          interactive
            ? () => {
                setHovered((h) => (h === k ? null : h));
                document.body.style.cursor = '';
              }
            : undefined
        }
        userData={{ joint: j, side: s }}
      >
        {interactive && hovered === k && !isSel && (
          <Html center distanceFactor={1.6} style={{ pointerEvents: 'none' }} position={[0, 1.9, 0]}>
            <div className="tooltip" style={{ position: 'static' }}>
              {jointLabel(j, s)}
            </div>
          </Html>
        )}
      </mesh>
    );
  };

  /** Arc showing the observed range, in the parent frame at the pivot (does not rotate with the limb). */
  const rangeArc = (j: Joint, s: Side): ReactNode => {
    if (!selected || !observedRange || selected.joint !== j || selected.side !== s) return null;
    return <RangeArc joint={j} side={s} movement={selected.movement} minDeg={observedRange.minDeg} maxDeg={observedRange.maxDeg} color={colors.arc} />;
  };

  const arm = (s: Side) => {
    const sx = sideSign(s);
    return (
      <group key={`arm-${s}`} position={[OFFSETS.shoulder[0] * (s === 'left' ? 1 : -1), OFFSETS.shoulder[1], 0]}>
        {rangeArc('shoulder', s)}
        {jointMarker('shoulder', s)}
        <group ref={registerPivot('shoulder', s)}>
          <mesh geometry={geos.upperArm} material={segMat('shoulder', s)} position={[0, -JOINT_RADIUS.shoulder * 0.55, 0]} castShadow />
          <group position={OFFSETS.elbow}>
            {rangeArc('elbow', s)}
            {jointMarker('elbow', s)}
            <group ref={registerPivot('elbow', s)}>
              <mesh geometry={geos.forearm} material={segMat('elbow', s)} position={[0, -JOINT_RADIUS.elbow * 0.5, 0]} castShadow />
              <group position={OFFSETS.wrist}>
                {rangeArc('wrist', s)}
                {jointMarker('wrist', s)}
                <group ref={registerPivot('wrist', s)}>
                  {/* Hand: palm faces forward (anatomical position). */}
                  <mesh geometry={geos.sphere} material={segMat('wrist', s)} position={[0, -0.085, 0.002]} scale={[0.04, 0.085, 0.018]} castShadow />
                  <mesh geometry={geos.sphere} material={segMat('wrist', s)} position={[sx * 0.04, -0.06, 0.012]} scale={[0.013, 0.04, 0.013]} rotation={[0, 0, sx * 0.5]} castShadow />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    );
  };

  const leg = (s: Side) => (
    <group key={`leg-${s}`} position={[OFFSETS.hip[0] * (s === 'left' ? 1 : -1), OFFSETS.hip[1], 0]}>
      {rangeArc('hip', s)}
      {jointMarker('hip', s)}
      <group ref={registerPivot('hip', s)}>
        <mesh geometry={geos.thigh} material={segMat('hip', s)} position={[0, -0.02, 0]} castShadow />
        <group position={OFFSETS.knee}>
          {rangeArc('knee', s)}
          {jointMarker('knee', s)}
          <group ref={registerPivot('knee', s)}>
            <mesh geometry={geos.shin} material={segMat('knee', s)} position={[0, -JOINT_RADIUS.knee * 0.5, 0]} castShadow />
            <group position={OFFSETS.ankle}>
              {rangeArc('ankle', s)}
              {jointMarker('ankle', s)}
              <group ref={registerPivot('ankle', s)}>
                {/* Foot points forward (+Z); heel slightly behind the ankle. */}
                <mesh geometry={geos.sphere} material={segMat('ankle', s)} position={[0, -0.045, 0.055]} scale={[0.045, 0.034, 0.125]} castShadow />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );

  return (
    <group position={[0, PELVIS_Y, 0]}>
      {/* Torso, neck and head (static). */}
      <mesh geometry={geos.torso} material={bodyMat} scale={[1, 1, 0.62]} castShadow receiveShadow />
      <mesh geometry={geos.neck} material={bodyMat} position={[0, 0.53, 0]} castShadow />
      <mesh geometry={geos.sphere} material={bodyMat} position={[0, 0.655, 0.005]} scale={[0.092, 0.118, 0.104]} castShadow />
      {SIDES.map((s) => arm(s))}
      {SIDES.map((s) => leg(s))}
    </group>
  );
}

function RangeArc({ joint, side, movement, minDeg, maxDeg, color }: { joint: Joint; side: Side; movement: Movement; minDeg: number; maxDeg: number; color: string }) {
  const { sector, outline, edgeMin, edgeMax } = useMemo(() => {
    const dir = (deg: number) => rotateVector(neutralDirection(joint), poseRotation(joint, movement, side, deg));
    const r = arcRadius(joint);
    return {
      sector: arcSector(dir, minDeg, maxDeg, r * 0.25, r),
      outline: arcLinePoints(dir, minDeg, maxDeg, r),
      edgeMin: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir(minDeg)).multiplyScalar(r)],
      edgeMax: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir(maxDeg)).multiplyScalar(r)],
    };
  }, [joint, side, movement, minDeg, maxDeg]);
  useEffect(() => () => sector.dispose(), [sector]);
  return (
    <group>
      <mesh geometry={sector} renderOrder={2}>
        <meshBasicMaterial color={color} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={outline} color={color} lineWidth={2.5} />
      <Line points={edgeMin} color={color} lineWidth={1.5} />
      <Line points={edgeMax} color={color} lineWidth={1.5} />
    </group>
  );
}
