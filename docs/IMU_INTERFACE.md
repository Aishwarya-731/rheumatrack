# Future IMU hardware interface

**Status: not implemented.** No hardware adapter exists, the app always shows "No sensor connected", and the Security Rules reject `source = 'hardware'`. The TypeScript contract is `src/hardware/ImuAdapter.ts`.

## Expected hardware

- One 6- or 9-axis IMU per segment on each side of the joint (e.g. upper arm + forearm for the elbow; thigh + shank for the knee; shank + foot for the ankle; trunk/pelvis + limb for shoulder/hip).
- Sampling rate 50–200 Hz (the importer accepts 1–1000 Hz). Timestamps from a monotonic device clock, converted to UTC epoch ms; drift between sensors must be corrected (common clock or periodic sync).
- Units: accelerometer m/s², gyroscope rad/s, magnetometer µT, quaternions `[w, x, y, z]`.

## Coordinate conventions

- **Sensor frame:** right-handed, as defined by the manufacturer; documented per device.
- **Segment (anatomical) frame:** right-handed; Y along the segment from distal to proximal, Z anterior, X lateral for the left side (mirrored for the right). This matches the 3D viewer (Y up, Z forward in neutral standing).
- **Joint angle:** rotation of the distal segment frame relative to the proximal one, decomposed for the movement plane (sagittal for flexion/extension and dorsi/plantarflexion; frontal for abduction). Sign conventions as in [VIEWER_3D.md](VIEWER_3D.md).

## Calibration (required before any recording is marked "hardware")

1. **Static neutral pose** (≥ 2 s, SD ≤ 2°): gravity direction gives each sensor's vertical axis.
2. **Functional movement** (e.g. slow flexion/extension) defines the joint axis.
3. Output: sensor-to-segment quaternion per sensor, neutral angle, hold SD, timestamp — stored like `CalibrationRecord` with `inputSource` extended to a hardware value.
4. Recalibrate whenever sensors are re-attached.

## Processing responsibilities

| Stage | Responsibility |
|---|---|
| Adapter | connect, stream raw readings, run calibration, fuse orientation (e.g. complementary/Kalman filter), compute joint angles, emit `AngleSample[]` |
| App (existing) | validate samples with the same rules as files, compute metrics, store with `source = 'hardware'` and the calibration ID, label it "Measured by connected sensor" |

## Before enabling

- Validate angle accuracy against a reference (goniometer or optical motion capture) per joint and movement; document error bounds.
- Update Security Rules to allow `hardware` only with a linked hardware calibration record.
- Movement segmentation (separating routine activity from standardised tasks — the problem statement's patent focus) is **not implemented**; it would sit between the adapter output and session creation.
