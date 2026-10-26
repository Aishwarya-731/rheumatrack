/**
 * Future IMU hardware interface (docs/IMU_INTERFACE.md).
 *
 * NO IMPLEMENTATION EXISTS. RheumaTrack never reports a sensor as connected and never creates
 * sessions with source = 'hardware' (the Security Rules reject them). This file defines the
 * contract a real adapter must satisfy before that can change.
 */
import type { Joint, Movement, Side } from '@/domain/joints';
import type { AngleSample } from '@/domain/types';

/** One raw inertial reading from one sensor. Units are SI. */
export interface ImuReading {
  /** Device timestamp converted to Unix epoch milliseconds (UTC). */
  t: number;
  /** Accelerometer, m/s², sensor frame. */
  accel: [number, number, number];
  /** Gyroscope, rad/s, sensor frame. */
  gyro: [number, number, number];
  /** Magnetometer, µT, sensor frame (optional; many joint-angle methods avoid it indoors). */
  mag?: [number, number, number];
  /** Orientation quaternion [w, x, y, z] if the device fuses on-board. */
  quat?: [number, number, number, number];
}

/** Placement of a sensor on a body segment. */
export interface SensorPlacement {
  sensorId: string;
  segment: 'upper-arm' | 'forearm' | 'hand' | 'thigh' | 'shank' | 'foot' | 'trunk' | 'pelvis';
  side: Side | 'midline';
}

export interface ImuCalibrationResult {
  /** Rotation from each sensor frame to its segment's anatomical frame, quaternion [w,x,y,z]. */
  sensorToSegment: Record<string, [number, number, number, number]>;
  /** Mean joint angle during the static neutral pose, degrees. */
  neutralAngleDeg: number;
  /** Static-pose angle standard deviation, degrees. */
  holdSdDeg: number;
  completedAt: number;
}

export type AdapterStatus =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected'; sensors: SensorPlacement[]; sampleRateHz: number; firmware: string }
  | { kind: 'error'; message: string };

/**
 * Responsibilities of an adapter:
 *  1. Discover and connect to sensors (e.g. Web Bluetooth) and report truthful status.
 *  2. Stream raw readings with device timestamps mapped to UTC epoch ms.
 *  3. Run the joint-specific calibration (static neutral pose + functional movement) and
 *     return the sensor-to-segment alignment; never report success without it.
 *  4. Convert calibrated segment orientations into a single joint angle for the requested
 *     movement plane (e.g. sagittal for flexion/extension), in degrees, using the sign
 *     conventions in docs/VIEWER_3D.md.
 *  5. Emit AngleSample[] that passes the same validation as imported files
 *     (src/domain/validation.ts) before any metrics are computed.
 */
export interface ImuAdapter {
  status(): AdapterStatus;
  onStatus(cb: (s: AdapterStatus) => void): () => void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  calibrate(joint: Joint, side: Side, movement: Movement): Promise<ImuCalibrationResult>;
  /** Records joint angles until stop() resolves. */
  record(joint: Joint, side: Side, movement: Movement, calibration: ImuCalibrationResult): { stop(): Promise<AngleSample[]> };
}
