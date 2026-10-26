# 3D viewer

Implementation: `src/features/viewer3d/` (three.js 0.186, @react-three/fiber 9, @react-three/drei 10). No external models, textures or HDR files are downloaded; everything is generated in code, so it works offline.

## Model

A procedural articulated **mannequin**: smooth lathe-generated limb segments (48 radial segments), an elliptical torso, head and hands/feet, with ball joints at 12 pivots (left/right shoulder, elbow, wrist, hip, knee, ankle). Generic adult proportions (~1.75 m). It is **not an anatomical model**; it does not represent bones, muscles or joint axes accurately, and it is not personalised. A licensed rigged GLB could replace the procedural meshes if the pivots keep the same names (see `Figure.tsx`).

Coordinates: Y up, figure faces +Z, ground at y = 0. The figure's **right side is at −X**, so when it faces the viewer its right side appears on the viewer's left (like the 2D body diagram).

## Interaction

- Click a joint ball, a body-diagram joint, or change the joint/side dropdowns → the shared selection updates everywhere and the camera glides to frame that joint. Sagittal-plane movements are framed from the side; abduction from the front.
- "Full body" or **Esc** zooms out; the reset button restores the default view. Drag to orbit, scroll to zoom.
- Hovering a joint shows its name. The 2D body diagram and dropdowns provide the keyboard-accessible equivalent.

## Three distinct values

| Value | Where | Label |
|---|---|---|
| Illustrative animation angle | Joints pages, animation mode | "Illustrative animation" + "Animation angle" readout; sweep from `joints.ts` `animation` ranges, explicitly not a reference |
| Imported sample angle | Session detail playback | "Imported sample angle"; the figure is posed by the recorded value of the current sample (no interpolation) |
| Calculated ROM | ROM rings, session metrics, and the arc in "Observed range" mode | "Observed ROM" / "Imported data — observed range" |

None is ever substituted for another. The observed-range arc is drawn only when imported data exists for the selection and only in "Observed range" mode.

## Pose sign conventions (`rig.ts`, tested in `rig.test.ts`)

| Joint / movement | Positive angle moves |
|---|---|
| shoulder, hip, wrist flexion | distal segment forward |
| shoulder, hip, wrist extension | backward |
| shoulder abduction | arm outward to its own side |
| elbow (flexion or extension) | angle = elbow flexion angle; forearm forward |
| knee (flexion or extension) | angle = knee flexion angle; shin backward |
| ankle dorsiflexion / plantarflexion | toes up / toes down |

Imported angles are applied with these conventions. Real sensors must produce angles in the same conventions (see IMU_INTERFACE.md).
