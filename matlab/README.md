# MATLAB workflow

All data produced here is **SYNTHETIC** (simulation-generated). It is not a measurement of any person, and the web app labels it "Simulation-generated data" / "Synthetic sample data" when imported as such.

| File | Purpose |
|---|---|
| `rt_config.m` | shared parameters (identical to `src/domain/analysisConfig.ts`) |
| `rt_generate_synthetic.m` | configurable synthetic joint-angle generator; exports CSV + JSON |
| `rt_read_movement_csv.m` | reads a RheumaTrack CSV |
| `rt_analyse_session.m` | observed ROM, min/max/mean, duration, interval statistics, irregular intervals, repetitions |
| `rt_verify_golden.m` | compares MATLAB metrics with `reference/golden/expected.json` |
| `rt_make_sample_datasets.m` | regenerates the 8 sample datasets in `samples/` |
| `samples/` | synthetic CSV/JSON datasets, a static-hold file for calibration, and 4 invalid files for testing rejection |

## Model

```
angle(t) = baseDeg + amplitudeDeg · (1 − cos(2π t / periodS)) / 2 + noise,   noise ~ N(0, noiseSdDeg²)
```
Configurable: joint, side, movement, sampling rate, duration, base angle, amplitude, period, noise SD, seed, start time. Values are clamped to ±180° and rounded to 0.01°.

## Running in MATLAB Online

1. Open <https://matlab.mathworks.com> and sign in.
2. Upload the project's `matlab/` **and** `reference/` folders (keep them side by side, e.g. `rheumatrack/matlab` and `rheumatrack/reference`). Drag-and-drop into the *Files* panel works; or upload the ZIP and run `unzip('rheumatrack.zip')`.
3. In the Command Window:
   ```matlab
   cd rheumatrack/matlab
   % Generate one recording (writes .csv and .json in the current folder)
   opts = struct('joint','knee','side','left','movement','flexion', ...
                 'sampleRateHz',50,'durationS',20,'amplitudeDeg',115,'periodS',4, ...
                 'noiseSdDeg',1.2,'seed',7,'outBase','knee_left_flexion_synthetic');
   [t, a] = rt_generate_synthetic(opts);

   % Analyse it
   m = rt_analyse_session(rt_read_movement_csv('knee_left_flexion_synthetic.csv'))

   % Verify MATLAB = Python reference = web app on the golden datasets
   rt_verify_golden

   % Regenerate all sample datasets
   rt_make_sample_datasets
   ```
4. Download the generated `.csv`/`.json` (right-click → Download) and import it in RheumaTrack (Import movement → choose "Simulation-generated").

## Comparing MATLAB with the website

- **Same input, same output.** `reference/golden/*.csv` are fixed inputs. `reference/python/rt_analysis.py` (independent implementation) writes `expected.json`. The web app's test `src/domain/golden.test.ts` and `rt_verify_golden.m` both compare against it with tolerance 1e-9 (sample counts, durations, irregular counts and repetitions must match exactly).
- **Manual check.** Import a MATLAB-generated file into the app; the session page shows min/max/ROM/mean/repetitions — compare with `rt_analyse_session` output (displayed to 1–2 decimals; exports carry full precision).
- **Generation differs by design.** MATLAB's random generator differs from the browser's, so the same seed yields different noise; comparisons are made on analysis of identical files.

Note: the files in `samples/` were produced with the TypeScript port of this model (`scripts/generate-samples.ts`) because MATLAB was not available when the project was assembled; `rt_make_sample_datasets.m` regenerates equivalents in MATLAB. The MATLAB scripts were **not executed** before delivery (see docs/VERIFICATION.md).
