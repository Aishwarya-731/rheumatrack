# Security model

Rules: `firebase/firestore.rules` · Tests: `tests/rules/firestore.rules.test.ts` (`npm run test:rules`).

Using Firebase does not by itself make the application secure. The guarantees below hold only if the rules in this repository are deployed and the configuration steps in [FIREBASE_SETUP.md](FIREBASE_SETUP.md) are followed.

## Access model

| Actor | Can read | Can write |
|---|---|---|
| Signed-out visitor | nothing | nothing |
| Patient (any signed-in user) | own `users/{uid}/**`, own role doc, own invites/shares | own profile and records (validated), own invites (create/revoke/delete), delete shares involving them |
| Clinician (role doc + verified email) | invites addressed to their verified email; **a patient's records only while `shares/{patient}_{clinician}` exists** | create a share from a pending invite addressed to them; remove their own shares. Never patient records. |
| Admin (service account, scripts only) | everything | roles |

Enforced properties (all covered by rules tests):

- A clinician cannot read a patient by changing a URL or document ID — reads require the share document *and* the clinician role.
- Sharing requires an explicit invite created by the patient, accepted only by a clinician whose **verified** email matches. A share cannot be created without a pending invite; another clinician cannot use it.
- Revoking (patient) or removing (clinician) deletes the share; access ends immediately. Removing the clinician role also ends access.
- Roles cannot be written by any client. The UI's role is only for navigation.
- Writes are validated: allowed keys, types, ranges (scores 0–10 integers, durations ≤ 1440, angles −180…180, ROM = max − min), supported joint/movement pairs, server timestamps (`createdAt == request.time`), `createdBy == owner`. Sessions with `source = 'hardware'` are rejected (no hardware exists). `isSynthetic` must be true exactly for simulation sessions.
- Session metrics and calibration records are immutable; only notes/edits that are intended are allowed.

## Client-side measures

- No privileged credentials in the frontend. The Firebase web config identifies the project only. Service-account keys are used only by `scripts/grant-clinician.ts`, must live outside the repo, and are git-ignored by pattern.
- Firestore uses an in-memory cache, so records are not left in IndexedDB.
- Exports neutralise spreadsheet formulas in text cells.
- Hosting sends `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` headers.
- Account deletion re-authenticates, deletes all records, invites and shares, then the auth account.
- Password policy in the UI: ≥ 8 characters with a letter and a digit. Configure the same (or stronger) policy in Firebase Authentication → Settings → Password policy so it is enforced server-side.

## App Check

Set `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_KEY` to enable App Check (reCAPTCHA Enterprise) in production. After monitoring traffic in the console, **enforce** App Check for Firestore and Authentication. App Check reduces abuse from scripts using your config; it does not replace Security Rules. It is disabled in the emulator.

## Remaining risks and required configuration

| Risk | Status / mitigation |
|---|---|
| Rules tests not executed in the delivery environment | Run `npm run test:rules` before deploying (see VERIFICATION.md). |
| Email enumeration on sign-in/reset | Enable *Email enumeration protection* in Firebase Authentication settings (default for new projects). |
| Brute-force attempts | Firebase Auth rate limiting; add App Check enforcement. |
| Invite email typos | Invite goes to whoever owns that verified email *and* holds the clinician role; patients see status and can revoke. |
| Clinician role administration | Manual via Admin SDK script; no audit UI. Keep a record of grants. |
| Exported files | Leave RheumaTrack's control once downloaded; UI warns. |
| Regulatory compliance (HIPAA, GDPR, DPDP Act 2023, etc.) | **Not assessed.** Requires a data-protection review, a BAA/DPA with Google Cloud where applicable, a privacy notice, and choosing a Firestore region appropriate for the users. |
| Penetration testing / threat modelling by a third party | Not performed. |
| Dependency vulnerabilities | Run `npm audit` regularly; `firebase-tools` has transitive warnings (dev-only). |

## Backups and retention

See [FIREBASE_SETUP.md § Backups and retention](FIREBASE_SETUP.md#backups-and-retention).
