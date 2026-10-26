# Project information

**Team:** Team KAIZEN

**Problem statement addressed:** Development of a wearable joint-mobility and inflammation-symptom correlation system (rheumatology track). Team and event details appear only in documentation, never in the application interface.

| Proposed innovation (problem statement) | RheumaTrack implementation |
|---|---|
| Wearable motion sensor tracking joint movement and ROM | Import of timestamped joint-angle recordings (MATLAB synthetic or external); documented IMU adapter interface for future hardware |
| Structured symptom assessment (pain, stiffness, discomfort) | 0–10 sliders per joint + duration + notes, timestamped, editable, never overwritten |
| Movement analysis engine | Validation + observed ROM, mean, duration, sampling quality, repetitions; reproduced in MATLAB and Python |
| Data correlation of sensor readings with symptoms | Time-window pairing + Spearman correlation, shown only with ≥ 10 pairs, with limitations |
| Trend detection of stiffness patterns and function | ROM and symptom trends per joint, left/right comparison, date ranges |
| Monitoring dashboard for clinician review | Dashboard, printable clinician report, consent-based read-only clinician access |
| Patent focus: joint-specific calibration and movement segmentation | Joint-specific static-reference calibration workflow implemented; sensor calibration and segmentation specified as future work |

See README.md for setup and docs/ for details.
