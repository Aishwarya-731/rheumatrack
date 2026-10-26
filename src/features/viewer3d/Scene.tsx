import { CameraControls, ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { useThemeColors } from '@/app/providers/ThemeProvider';
import type { Joint, Movement, Side } from '@/domain/joints';
import { cameraOffset } from './rig';

export const FULL_BODY_VIEW = { position: [1.55, 1.3, 3.05] as const, target: [0, 0.9, 0] as const };

export function useViewerColors() {
  const c = useThemeColors(['viewer-bg', 'viewer-floor', 'viewer-body', 'viewer-joint', 'accent', 'warning'] as const);
  return {
    bg: c['viewer-bg'],
    floor: c['viewer-floor'],
    figure: { body: c['viewer-body'], jointIdle: c['viewer-joint'], accent: c.accent, arc: c.warning },
  };
}

/**
 * Frames the camera on a joint (smooth transition) or on the full body. Runs inside the Canvas.
 */
export function CameraRig({
  focus,
  pivots,
  controlsRef,
}: {
  focus: { joint: Joint; side: Side; movement: Movement } | null;
  pivots: RefObject<Map<string, THREE.Object3D>>;
  controlsRef: RefObject<CameraControls | null>;
}) {
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Wait one frame so the pivot transforms are up to date.
    const id = requestAnimationFrame(() => {
      if (!focus) {
        void controls.setLookAt(...FULL_BODY_VIEW.position, ...FULL_BODY_VIEW.target, true);
        return;
      }
      const pivot = pivots.current?.get(`${focus.joint}:${focus.side}`);
      if (!pivot) return;
      const p = new THREE.Vector3();
      pivot.parent?.updateWorldMatrix(true, false);
      pivot.getWorldPosition(p);
      const [ox, oy, oz] = cameraOffset(focus.joint, focus.side, focus.movement);
      void controls.setLookAt(p.x + ox, p.y + oy, p.z + oz, p.x, p.y, p.z, true);
    });
    return () => cancelAnimationFrame(id);
  }, [focus, pivots, controlsRef]);
  return null;
}

/** Canvas with lighting, floor and soft contact shadow. No network assets are used. */
export function ViewerCanvas({ children, height, bg, floor, label, controlsRef }: { children: ReactNode; height: number | string; bg: string; floor: string; label: string; controlsRef: RefObject<CameraControls | null> }) {
  return (
    <div style={{ height, width: '100%', borderRadius: 14, overflow: 'hidden', background: bg, position: 'relative' }} role="img" aria-label={label}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [...FULL_BODY_VIEW.position], fov: 32, near: 0.05, far: 50 }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={[bg]} />
        <hemisphereLight args={['#ffffff', floor, 0.85]} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.55} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <directionalLight position={[-3, 2.5, -2]} intensity={0.55} />
        <directionalLight position={[0, 1.5, -4]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[2.2, 64]} />
          <meshStandardMaterial color={floor} roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.45} scale={3} blur={2.4} far={1.2} resolution={512} />
        <CameraControls ref={controlsRef} makeDefault minDistance={0.35} maxDistance={6} maxPolarAngle={Math.PI * 0.55} smoothTime={0.45} />
        {children}
      </Canvas>
    </div>
  );
}
