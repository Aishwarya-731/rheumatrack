# Architecture and data flow

## Overview

```
┌──────────────────────────── Browser (React 19 + TypeScript, Vite) ────────────────────────────┐
│  features/* pages ──► app/providers (Auth, Records, Selection, Theme, Toast)                    │
│        │                         │                                                              │
│        ▼                         ▼                                                              │
│  domain/* (pure TS)       data/services.ts  (interfaces: AuthService, DataService)              │
│  validation, metrics,            │                                                              │
│  repetitions, correlation,       ├── data/firestore/*  → Firebase Auth + Cloud Firestore        │
│  export, reminders …             └── data/memory/*     → in-memory (automated tests only)       │
│                                                                                                 │
│  features/viewer3d (three.js + React Three Fiber + drei): procedural articulated figure         │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
            │  HTTPS (Firebase SDK)                                   ▲
            ▼                                                         │ Admin SDK (scripts only)
┌──────────── Firebase ────────────┐                          scripts/grant-clinician.ts
│ Authentication (email/password)  │                          scripts/seed-emulator.ts
│ Cloud Firestore + Security Rules │
│ Hosting (static dist/)           │
│ App Check (optional)             │
└──────────────────────────────────┘

 Offline: matlab/*.m  ⇄  CSV/JSON files  ⇄  web importer;  reference/python  ⇄  golden datasets
```

**Key design choices**

- **Pure domain layer.** All validation and analysis live in `src/domain` with no React or Firebase imports. The same functions run in the browser, in Node scripts and in tests, and are cross-checked against independent Python and MATLAB implementations on golden datasets.
- **Service interfaces.** Pages never import Firebase directly. `DataService` has a Firestore implementation and an in-memory implementation; the latter enforces the same owner/share permission logic and is used only for automated tests.
- **Server-trusted roles.** The clinician role lives in `/roles/{uid}`, writable only with the Admin SDK. The UI reads it for navigation; Security Rules enforce it on every read.
- **Consent-based sharing.** Invite (patient) → accept (verified clinician, same email) → share document. Revocation deletes the share; access stops immediately.
- **Provenance everywhere.** Every session carries `source` (`imported` / `simulation`; `hardware` is impossible today) and `isSynthetic`. The UI badges and every export column show it.
- **Distinct values.** Illustrative animation angle, imported sample angle and calculated ROM are separate values with separate labels; none is substituted for another.
- **No health data persisted in the browser.** Firestore uses an in-memory cache only. Local storage holds UI preferences (theme, sidebar, current joint selection, dismissed reminder time).

## Routes

| Path | Page | Access |
|---|---|---|
| `/login`, `/signup`, `/reset-password` | auth | signed-out only |
| `/` | dashboard | patient |
| `/joints`, `/joints/:joint/:side` | body diagram, 3D viewer, ROM rings, joint detail | patient |
| `/movement/import` | file import + validation | patient |
| `/sessions/:id` | session detail with sample playback | patient |
| `/calibration` | static-reference calibration | patient |
| `/symptoms/new`, `/symptoms/:id` | check-in form, detail/edit/delete | patient |
| `/history` | sessions / check-ins with filters | patient |
| `/analytics` | trends + association | patient |
| `/reports`, `/reports/clinician`, `/reports/session/:id` | exports and printable reports | patient |
| `/sharing` | invite / revoke clinicians | patient |
| `/settings` | profile, theme, reminders, data deletion | all |
| `/clinician` | invitations and shared patients | clinician |
| `/clinician/patients/:uid/…` | read-only copy of the patient pages above | clinician with share |

## Firestore data model

```
roles/{uid}                         { role: 'clinician', grantedAt, grantedBy }      Admin SDK only
users/{uid}                         { displayName, email, createdAt, reminders{enabled,time,days[],timezone},
                                      preferredJoint, preferredSide, schemaVersion, updatedAt? }
users/{uid}/sessions/{sid}          { joint, side, movement, source, isSynthetic, sourceFileName, sourceFormat,
                                      startedAt, endedAt, createdAt, createdBy, metrics{…}, calibrationId,
                                      calibrationStatus, notes, chunkCount, schemaVersion, updatedAt? }
users/{uid}/sessions/{sid}/chunks/{0000…}   { index, t: number[] (epoch ms), a: number[] (deg) }  ≤ 5000 samples each
users/{uid}/assessments/{aid}       { joint, side, pain, stiffness, discomfort, durationMinutes, notes,
                                      assessedAt, createdAt, updatedAt, createdBy, isSynthetic, schemaVersion }
users/{uid}/calibrations/{cid}      { joint, side, movement, inputSource, sourceFileName, outcome,
                                      referenceAngleDeg, holdSdDeg, holdDurationMs, sampleCount,
                                      validationMessages[], config{…}, createdAt, createdBy, schemaVersion }
invites/{id}                        { patientUid, patientName, clinicianEmail, status, createdAt }
shares/{patientUid}_{clinicianUid}  { patientUid, clinicianUid, clinicianEmail, patientName, inviteId, createdAt }
```

- Document IDs are Firestore auto-IDs (stable, never reused). Share IDs are deterministic so rules can check existence.
- `createdAt`/`updatedAt` are server timestamps (rules require `== request.time`), giving audit-relevant metadata that clients cannot back-date. `createdBy` records the writer.
- New records never overwrite old ones: each check-in and session is its own document. Session metrics are immutable; only notes can change.
- Samples are chunked because Firestore documents are limited to 1 MiB. The session document is written in the same batch after its chunks.
- Lists load the latest 1000 records per collection; filtering and analytics run client-side on that set (see REMAINING_WORK for scaling).

## Indexes

All queries are single-field or equality-only; Firestore's automatic indexes serve them. `firebase/firestore.indexes.json` declares the composite `(clinicianEmail, status)` index on `invites` explicitly.

## Dependency versions (as installed and verified)

| Package | Version | Purpose |
|---|---|---|
| react / react-dom | 19.3.1 | UI |
| typescript | 5.9.3 | strict typing (TS 7 not adopted yet) |
| vite / @vitejs/plugin-react | 8.3.5 / 6.1.2 | build/dev server |
| react-router | 7.18.4 | routing |
| firebase | 12.19.0 | Auth + Firestore SDK (Node 22-compatible line) |
| three / @react-three/fiber / @react-three/drei | 0.186.1 / 9.8.2 / 10.7.9 | 3D viewer |
| recharts | 3.10.1 | charts |
| lucide-react | 1.61.0 | icons |
| papaparse | 5.7.0 | CSV parsing/writing |
| vitest / jsdom / @testing-library/* | 5.0.5 / 30.1.3 / 16.x, 14.x, 7.x | unit/integration tests |
| @playwright/test | 1.64.1 | E2E |
| @firebase/rules-unit-testing | 5.0.2 | rules tests |
| firebase-tools / firebase-admin | 15.34.1 / 14.5.0 | emulators, deploy, admin scripts |


## Code splitting

Pages are lazy-loaded. The 3D stack (~330 kB gzip) loads only on pages with a viewer; Firebase (~170 kB gzip) and charts (~115 kB gzip) are separate vendor chunks.
