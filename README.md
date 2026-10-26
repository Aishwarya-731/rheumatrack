# RheumaTrack

Multi-joint mobility monitoring and symptom-assessment web application.

RheumaTrack lets a person record pain, stiffness and discomfort per joint, import timestamped joint-angle recordings (MATLAB-generated or externally acquired), review observed range of motion (ROM) over time, compare symptoms with movement, and share read-only reports with a clinician they explicitly invite.

> **RheumaTrack is not a diagnostic system.** It does not diagnose rheumatoid arthritis or any other condition. Observed ROM is *max − min angle in one recording* and has not been clinically validated. No sensor hardware is connected; the hardware interface is documented for future work only.

Project team: **Team KAIZEN** (documentation only — not shown in the application).

---

## Contents

1. [Requirements](#requirements)
2. [Quick start — fully local, no Firebase account](#quick-start--fully-local-no-firebase-account)
3. [Scripts](#scripts)
4. [Testing](#testing)
5. [Firebase setup (real project) and deployment](#firebase-setup-real-project-and-deployment)
6. [MATLAB workflow](#matlab-workflow)
7. [Project structure](#project-structure)
8. [Documentation index](#documentation-index)
9. [Troubleshooting](#troubleshooting)

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| Node.js | **22.12 or newer** (LTS 22 or 24) | everything |
| npm | 10+ | everything |
| Java (JDK/JRE) | **21 or newer** (required by firebase-tools 15) | Firebase Emulator Suite (local backend, rules tests, emulator E2E) |
| Python | 3.10+ (optional) | regenerating golden reference values |
| MATLAB / MATLAB Online | R2021a+ (optional) | MATLAB scripts in `matlab/` |

Install Java on Windows/macOS from <https://adoptium.net> (Temurin 21). Check with `java -version`.

## Quick start — fully local, no Firebase account

```bash
# 1. unzip, open the folder in VS Code, then in a terminal:
npm install

# 2. start the local Firebase emulators + the web app together
npm run dev:local
#    App:            http://127.0.0.1:5173
#    Emulator UI:    http://127.0.0.1:4000

# 3. (optional, second terminal) create demo accounts with clearly labelled SYNTHETIC data
npm run seed
```

Demo accounts created by `npm run seed` (local emulator only):

| Role | Email | Password |
|---|---|---|
| Patient (has synthetic data, shared with the clinician) | `patient@rheumatrack.test` | `Patient123` |
| Clinician | `clinician@rheumatrack.test` | `Clinician123` |

You can also sign up a new account in the app. New accounts are always personal (patient) accounts. To make an account a clinician:

```bash
npm run grant-clinician -- --emulator someone@example.com
# then sign out and back in. Clinicians must verify their email to receive invitations;
# in the emulator the verification link is printed in the emulator terminal.
```

Emulator data is in memory and disappears when the emulators stop. Use `npm run emulators:persist` (instead of `npm run emulators`) to save it to `.emulator-data/` between runs.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev:local` | Firebase emulators + Vite dev server against them |
| `npm run emulators` / `npm run dev:emu` | the two halves of `dev:local`, separately |
| `npm run seed` | demo accounts + synthetic data in the emulators |
| `npm run dev` | dev server against a real project from `.env.local` |
| `npm run typecheck` | strict TypeScript check (app, scripts, tests) |
| `npm test` | unit + integration tests (Vitest, jsdom) |
| `npm run test:rules` | Firestore Security Rules tests (starts the Firestore emulator; needs Java) |
| `npm run test:e2e:install` | downloads Playwright's Chromium (once) |
| `npm run test:e2e` | browser E2E against the emulators — run `npm run emulators` and `npm run seed` first |
| `npm run test:e2e:harness` | the same E2E suite against an in-memory test build (no Firebase needed) |
| `npm run build` | type-check + production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run deploy` | build and deploy Hosting + Firestore rules/indexes to your project |
| `npm run grant-clinician -- …` | grant/revoke the clinician role (Admin SDK) |
| `npm run golden` | regenerate `reference/golden/expected.json` with the Python reference |

## Testing

```bash
npm run typecheck
npm test                    # 135 unit/integration tests
npm run test:rules          # needs Java
npm run test:e2e:install
npm run test:e2e:harness    # no Firebase needed
npm run emulators & npm run seed && npm run test:e2e   # full stack
```

What each suite covers and what was actually run before delivery is listed in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Firebase setup (real project) and deployment

Step-by-step instructions, including App Check, granting clinician roles, backups and retention: **[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)**. In short:

1. Create a Firebase project (the free Spark plan is sufficient), add a **Web app**, enable **Authentication → Email/Password**, create a **Cloud Firestore** database.
2. `cp .env.example .env.local` and fill in the web-app values.
3. `npx firebase login` and `npx firebase use --add` (choose your project).
4. `npm run deploy` (builds, then deploys Hosting, Security Rules and indexes).
5. Grant clinicians with a service-account key kept **outside** the project folder:
   `GOOGLE_APPLICATION_CREDENTIALS=/path/key.json npm run grant-clinician -- --project <id> doc@example.com`

## MATLAB workflow

See **[matlab/README.md](matlab/README.md)** — generating synthetic data in MATLAB Online, exporting CSV/JSON, analysing a session, and verifying that MATLAB, Python and the web app produce identical metrics.

## Project structure

```
src/
  app/            providers (theme, auth, selection, records, toasts), layout, routes
  components/     UI primitives, charts, joint picker, filters
  data/           service interfaces, Firestore implementation, in-memory test implementation
  design/         design tokens (light + dark) and CSS
  domain/         pure TypeScript: joints, validation, metrics, repetitions, correlation,
                  symptoms, filters, export, reminders, calibration, synthetic generator
  features/       pages: auth, dashboard, joints, viewer3d, movement, symptoms, history,
                  analytics, reports, sharing, clinician, calibration, settings, setup
  hardware/       ImuAdapter interface (no implementation)
  test-harness/   in-memory build used only by automated browser tests
firebase/         firestore.rules, firestore.indexes.json
scripts/          seed-emulator, grant-clinician, golden/sample generators
matlab/           MATLAB scripts + synthetic and invalid sample files
reference/        Python reference analysis + golden datasets
tests/            rules tests, Playwright E2E
docs/             architecture, data contract, security, Firebase setup, verification …
```

## Documentation index

- [Architecture & data flow](docs/ARCHITECTURE.md)
- [Movement data contract (CSV/JSON, validation, metrics, export)](docs/DATA_CONTRACT.md)
- [Security model & remaining risks](docs/SECURITY.md)
- [Firebase setup, deployment, backups](docs/FIREBASE_SETUP.md)
- [Deploying the frontend on Vercel](docs/DEPLOY_VERCEL.md)
- [Symptom scale, association analysis, reminders](docs/ANALYTICS.md)
- [Calibration workflow](docs/CALIBRATION.md)
- [3D viewer conventions and limitations](docs/VIEWER_3D.md)
- [Future IMU hardware interface](docs/IMU_INTERFACE.md)
- [Verification report](docs/VERIFICATION.md)
- [Remaining work before real-world use](docs/REMAINING_WORK.md)

## Troubleshooting

| Symptom | Fix |
|---|---|
| “Setup required” page | No Firebase config. Use `npm run dev:local`, or create `.env.local` from `.env.example`. |
| `firebase: command not found` | Use the npm scripts (they use the local `firebase-tools`), or `npx firebase …`. |
| Emulators fail: “Could not spawn java” | Install Java 21+ and reopen the terminal. |
| Port 8080 / 9099 / 5173 in use | Stop the other process, or change ports in `firebase.json` and the `VITE_EMULATOR_*` variables. |
| Clinician sees no invitations | Email must be verified, the role granted, and the clinician signed out/in after the grant. |
| 3D viewer blank | The browser must support WebGL (enable hardware acceleration). |
| `npm run golden` fails on Windows | Use `python reference/python/rt_analysis.py --write-expected reference/golden`. |
