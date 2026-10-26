import { describe, expect, it } from 'vitest';
import { illustrativeAngle } from './animation';
import { neutralDirection, poseRotation, rotateVector } from './rig';

const dir = (joint: Parameters<typeof poseRotation>[0], movement: Parameters<typeof poseRotation>[1], side: Parameters<typeof poseRotation>[2], deg: number) =>
  rotateVector(neutralDirection(joint), poseRotation(joint, movement, side, deg)).map((v) => Math.round(v * 1000) / 1000 + 0);

describe('3D pose conventions', () => {
  it('shoulder flexion raises the arm forward (+Z), extension backward', () => {
    expect(dir('shoulder', 'flexion', 'right', 90)).toEqual([0, 0, 1]);
    expect(dir('shoulder', 'extension', 'left', 90)).toEqual([0, 0, -1]);
  });

  it('shoulder abduction raises each arm outward to its own side', () => {
    // The figure's left side is +X, right side is −X.
    expect(dir('shoulder', 'abduction', 'left', 90)).toEqual([1, 0, 0]);
    expect(dir('shoulder', 'abduction', 'right', 90)).toEqual([-1, 0, 0]);
  });

  it('knee flexion bends the shin backward; hip flexion brings the thigh forward', () => {
    expect(dir('knee', 'flexion', 'left', 90)).toEqual([0, 0, -1]);
    expect(dir('hip', 'flexion', 'left', 90)).toEqual([0, 0, 1]);
  });

  it('ankle dorsiflexion lifts the toes; plantarflexion points them down', () => {
    expect(dir('ankle', 'dorsiflexion', 'right', 90)).toEqual([0, 1, 0]);
    expect(dir('ankle', 'plantarflexion', 'right', 90)).toEqual([0, -1, 0]);
  });

  it('zero angle is the neutral pose', () => {
    expect(dir('elbow', 'flexion', 'left', 0)).toEqual([0, -1, 0]);
  });

  it('illustrative animation sweeps from → to → from over one cycle', () => {
    expect(illustrativeAngle(0, 130, 0)).toBe(0);
    expect(illustrativeAngle(0, 130, 0.5)).toBeCloseTo(130, 10);
    expect(illustrativeAngle(140, 0, 0.5)).toBeCloseTo(0, 10);
    expect(illustrativeAngle(0, 100, 1.25)).toBeCloseTo(50, 10);
  });
});
