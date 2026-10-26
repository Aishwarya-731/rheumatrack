import type { Joint, Movement, Side } from '@/domain/joints';

/**
 * Articulated figure definition (metres, Y up, figure faces +Z, ground at y = 0).
 * The figure's RIGHT side is at negative X, so when it faces the camera its right arm
 * appears on the viewer's left — as with a person facing you.
 *
 * This is a stylised articulated model, not an anatomical reconstruction. Proportions are
 * generic adult proportions chosen for readability.
 */

export const PELVIS_Y = 0.98;

export interface LimbSegment {
  length: number;
  /** Profile radii: near the proximal joint, at the widest point, near the distal joint. */
  radii: [number, number, number];
}

export const SEGMENTS = {
  upperArm: { length: 0.29, radii: [0.044, 0.05, 0.035] },
  forearm: { length: 0.255, radii: [0.038, 0.041, 0.027] },
  thigh: { length: 0.43, radii: [0.076, 0.082, 0.05] },
  shin: { length: 0.42, radii: [0.052, 0.058, 0.034] },
} as const satisfies Record<string, LimbSegment>;

export const JOINT_RADIUS: Record<Joint, number> = {
  shoulder: 0.056,
  elbow: 0.043,
  wrist: 0.031,
  hip: 0.066,
  knee: 0.056,
  ankle: 0.039,
};

/** Pivot offsets relative to the pelvis (shoulder, hip) or the parent pivot. x is for the LEFT side; mirrored for right. */
export const OFFSETS: Record<Joint, [number, number, number]> = {
  shoulder: [0.196, 0.44, 0],
  elbow: [0, -SEGMENTS.upperArm.length, 0],
  wrist: [0, -SEGMENTS.forearm.length, 0],
  hip: [0.095, -0.05, 0],
  knee: [0, -SEGMENTS.thigh.length, 0],
  ankle: [0, -SEGMENTS.shin.length, 0],
};

export function sideSign(side: Side): 1 | -1 {
  return side === 'left' ? 1 : -1;
}

export type Euler3 = [number, number, number];

const DEG = Math.PI / 180;

/**
 * Converts a joint angle (degrees) for a movement into the local rotation of that joint's
 * pivot. Sign conventions (documented in docs/VIEWER_3D.md):
 *  - shoulder/hip/wrist flexion: limb rotates forward; extension: backward
 *  - shoulder abduction: arm rotates out to the side
 *  - elbow/knee: the angle is the joint's flexion angle for both "flexion" and
 *    "extension" movements (extension = straightening from a bent position)
 *  - knee flexion bends the shin backward; elbow flexion brings the forearm forward
 *  - ankle dorsiflexion lifts the toes; plantarflexion points them down
 */
export function poseRotation(joint: Joint, movement: Movement, side: Side, angleDeg: number): Euler3 {
  const a = angleDeg * DEG;
  switch (joint) {
    case 'shoulder':
      if (movement === 'abduction') return [0, 0, sideSign(side) * a];
      return movement === 'extension' ? [a, 0, 0] : [-a, 0, 0];
    case 'hip':
    case 'wrist':
      return movement === 'extension' ? [a, 0, 0] : [-a, 0, 0];
    case 'elbow':
      return [-a, 0, 0];
    case 'knee':
      return [a, 0, 0];
    case 'ankle':
      return movement === 'plantarflexion' ? [a, 0, 0] : [-a, 0, 0];
  }
}

/** Direction the distal segment points in the parent frame when the joint is at rest. */
export function neutralDirection(joint: Joint): [number, number, number] {
  return joint === 'ankle' ? [0, 0, 1] : [0, -1, 0];
}

/** Arc radius for the observed-range indicator at a joint. */
export function arcRadius(joint: Joint): number {
  switch (joint) {
    case 'shoulder':
      return 0.2;
    case 'elbow':
      return 0.17;
    case 'wrist':
      return 0.11;
    case 'hip':
      return 0.26;
    case 'knee':
      return 0.24;
    case 'ankle':
      return 0.14;
  }
}

/**
 * Camera framing for a joint: offset of the camera from the joint's world position.
 * Sagittal-plane movements (flexion/extension, dorsi/plantarflexion) are framed from the
 * side so the motion is visible; abduction (frontal plane) is framed from the front.
 */
export function cameraOffset(joint: Joint, side: Side, movement: Movement): [number, number, number] {
  const s = sideSign(side);
  const dist: Record<Joint, number> = { shoulder: 2.0, elbow: 1.75, wrist: 1.25, hip: 2.3, knee: 2.0, ankle: 1.5 };
  const d = dist[joint];
  const lift = joint === 'ankle' ? 0.25 : joint === 'hip' ? 0.05 : 0.12;
  if (movement === 'abduction') return [s * d * 0.25, lift, d];
  return [s * d * 0.92, lift, d * 0.42];
}

export function rotateVector(v: [number, number, number], e: Euler3): [number, number, number] {
  // Rotation order XYZ as in three.js default Euler order: R = Rx · Ry · Rz applied to v.
  const [x0, y0, z0] = v;
  const [ax, ay, az] = e;
  // Rz
  let x = x0 * Math.cos(az) - y0 * Math.sin(az);
  let y = x0 * Math.sin(az) + y0 * Math.cos(az);
  let z = z0;
  // Ry
  const x1 = x * Math.cos(ay) + z * Math.sin(ay);
  const z1 = -x * Math.sin(ay) + z * Math.cos(ay);
  x = x1;
  z = z1;
  // Rx
  const y2 = y * Math.cos(ax) - z * Math.sin(ax);
  const z2 = y * Math.sin(ax) + z * Math.cos(ax);
  y = y2;
  z = z2;
  return [x, y, z];
}
