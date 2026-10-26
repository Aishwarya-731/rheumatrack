/**
 * Joint catalogue: the single source of truth for supported joints, sides and movements.
 *
 * `animation` ranges drive the *illustrative* 3D animation only. They are chosen so the
 * figure moves visibly and plausibly; they are NOT clinical reference values or thresholds
 * and must never be presented as such.
 */

export const JOINTS = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'] as const;
export type Joint = (typeof JOINTS)[number];

export const SIDES = ['left', 'right'] as const;
export type Side = (typeof SIDES)[number];

export const MOVEMENTS = [
  'flexion',
  'extension',
  'abduction',
  'dorsiflexion',
  'plantarflexion',
] as const;
export type Movement = (typeof MOVEMENTS)[number];

export interface MovementDefinition {
  id: Movement;
  label: string;
  /** Short plain-language description shown in the UI. */
  description: string;
  /** Illustrative animation sweep in degrees (from → to). Not a clinical reference. */
  animation: { from: number; to: number };
}

export interface JointDefinition {
  id: Joint;
  label: string;
  region: 'upper' | 'lower';
  movements: readonly MovementDefinition[];
}

export const JOINT_CATALOGUE: Record<Joint, JointDefinition> = {
  shoulder: {
    id: 'shoulder',
    label: 'Shoulder',
    region: 'upper',
    movements: [
      { id: 'flexion', label: 'Flexion', description: 'Raising the arm forward and up.', animation: { from: 0, to: 160 } },
      { id: 'extension', label: 'Extension', description: 'Moving the arm backward behind the body.', animation: { from: 0, to: 45 } },
      { id: 'abduction', label: 'Abduction', description: 'Raising the arm out to the side.', animation: { from: 0, to: 160 } },
    ],
  },
  elbow: {
    id: 'elbow',
    label: 'Elbow',
    region: 'upper',
    movements: [
      { id: 'flexion', label: 'Flexion', description: 'Bending the elbow, bringing the hand toward the shoulder.', animation: { from: 0, to: 140 } },
      { id: 'extension', label: 'Extension', description: 'Straightening the elbow from a bent position.', animation: { from: 140, to: 0 } },
    ],
  },
  wrist: {
    id: 'wrist',
    label: 'Wrist',
    region: 'upper',
    movements: [
      { id: 'flexion', label: 'Flexion', description: 'Bending the palm toward the forearm.', animation: { from: 0, to: 70 } },
      { id: 'extension', label: 'Extension', description: 'Bending the back of the hand toward the forearm.', animation: { from: 0, to: 60 } },
    ],
  },
  hip: {
    id: 'hip',
    label: 'Hip',
    region: 'lower',
    movements: [
      { id: 'flexion', label: 'Flexion', description: 'Bringing the thigh forward and up.', animation: { from: 0, to: 110 } },
      { id: 'extension', label: 'Extension', description: 'Moving the thigh backward.', animation: { from: 0, to: 25 } },
    ],
  },
  knee: {
    id: 'knee',
    label: 'Knee',
    region: 'lower',
    movements: [
      { id: 'flexion', label: 'Flexion', description: 'Bending the knee, bringing the heel toward the buttock.', animation: { from: 0, to: 130 } },
      { id: 'extension', label: 'Extension', description: 'Straightening the knee from a bent position.', animation: { from: 130, to: 0 } },
    ],
  },
  ankle: {
    id: 'ankle',
    label: 'Ankle',
    region: 'lower',
    movements: [
      { id: 'dorsiflexion', label: 'Dorsiflexion', description: 'Pulling the toes up toward the shin.', animation: { from: 0, to: 20 } },
      { id: 'plantarflexion', label: 'Plantarflexion', description: 'Pointing the toes downward.', animation: { from: 0, to: 45 } },
    ],
  },
};

export function isJoint(value: unknown): value is Joint {
  return typeof value === 'string' && (JOINTS as readonly string[]).includes(value);
}

export function isSide(value: unknown): value is Side {
  return typeof value === 'string' && (SIDES as readonly string[]).includes(value);
}

export function isMovement(value: unknown): value is Movement {
  return typeof value === 'string' && (MOVEMENTS as readonly string[]).includes(value);
}

export function movementsFor(joint: Joint): readonly MovementDefinition[] {
  return JOINT_CATALOGUE[joint].movements;
}

export function isMovementSupported(joint: Joint, movement: Movement): boolean {
  return JOINT_CATALOGUE[joint].movements.some((m) => m.id === movement);
}

export function getMovement(joint: Joint, movement: Movement): MovementDefinition | undefined {
  return JOINT_CATALOGUE[joint].movements.find((m) => m.id === movement);
}

export function defaultMovement(joint: Joint): Movement {
  const first = JOINT_CATALOGUE[joint].movements[0];
  if (!first) throw new Error(`Joint ${joint} has no movements defined`);
  return first.id;
}

export function jointLabel(joint: Joint, side?: Side): string {
  const base = JOINT_CATALOGUE[joint].label;
  if (!side) return base;
  return `${side === 'left' ? 'Left' : 'Right'} ${base.toLowerCase()}`;
}

export function sideLabel(side: Side): string {
  return side === 'left' ? 'Left' : 'Right';
}

export function movementLabel(movement: Movement): string {
  return movement.charAt(0).toUpperCase() + movement.slice(1);
}

/** Stable key used for maps and URLs, e.g. "knee:right". */
export type JointKey = `${Joint}:${Side}`;
export function jointKey(joint: Joint, side: Side): JointKey {
  return `${joint}:${side}`;
}

export const ALL_JOINT_SIDES: ReadonlyArray<{ joint: Joint; side: Side }> = JOINTS.flatMap((joint) =>
  SIDES.map((side) => ({ joint, side })),
);
