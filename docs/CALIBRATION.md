# Calibration workflow

Implementation: `src/features/calibration/CalibrationPage.tsx`, `src/domain/calibration.ts`.

## What exists

No sensor hardware is connected, so **sensor calibration** (sensor-to-segment alignment, offsets) cannot be performed and is never shown as completed. The page states this and the "Connected sensor" input is disabled.

What *can* be performed is a **static-reference check**:

1. **Select** joint, side and movement; read the instructions (hold the joint still in its neutral position for ≥ 2 s and record it).
2. **Start** → choose the input source. Only "Static reference recording file (.csv/.json)" is available.
3. **Validate:** the file passes the normal import validation, must match the selected joint/side/movement, and must satisfy:
   - ≥ 20 samples, ≥ 2 s duration, angle standard deviation ≤ 2° (data-quality limits, not clinical).
4. **Result:** completed or not completed, with every check listed. The user can save the result (completed *or* failed attempts are recorded), **retry** with another file, or **cancel** (nothing saved).

Stored metadata: joint, side, movement, input source, file name, outcome, reference angle (mean of the hold), hold SD, hold duration, sample count, validation messages, the configuration used, server timestamp, author. Records are immutable.

## How it is used

When importing a session, the user may link a *completed* static reference for the same joint/side/movement. The session then shows "Static reference linked" and the reference value as **metadata**. Imported angles are **never modified**, and imported data is never labelled as calibrated sensor data. Sessions without a link show "Not calibrated".

A synthetic static-hold file for testing is in `matlab/samples/synthetic_static_hold_knee_right.csv`.

## For real hardware

The sensor calibration contract is defined in `src/hardware/ImuAdapter.ts` (`calibrate()` returns sensor-to-segment quaternions, neutral angle and hold SD) and [IMU_INTERFACE.md](IMU_INTERFACE.md).
