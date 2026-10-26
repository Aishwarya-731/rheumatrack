# Remaining work before real-world use

## Must do before any deployment with real users

1. **Run the unexecuted checks** in [VERIFICATION.md](VERIFICATION.md): `npm run test:rules`, emulator E2E, MATLAB `rt_verify_golden`. Fix anything that fails.
2. **Create and configure the Firebase project** ([FIREBASE_SETUP.md](FIREBASE_SETUP.md)): region choice, password policy, email-enumeration protection, App Check enforcement, authorised domains.
3. **Deploy and verify** the deployed site end to end (sign-up, check-in, import, share, revoke, delete account).
4. **Legal and data protection:** privacy notice, terms, consent wording reviewed by a professional; applicable law (e.g. India's DPDP Act 2023, GDPR, HIPAA if relevant); data-processing agreement with Google Cloud; retention policy; backups (Blaze plan) and a tested restore.
5. **Clinical governance:** the app makes no clinical claims; any clinical use requires review, and medical-device regulation may apply if functionality expands.

## Product gaps (implemented honestly as limited, or not implemented)

| Area | Current state | Needed for real use |
|---|---|---|
| Sensor hardware | none; interface only | IMU adapter, sensor calibration, accuracy validation vs goniometer/motion capture |
| Movement segmentation (routine vs standardised tasks) | not implemented | algorithm + validation (problem statement's patent focus) |
| Clinical validation of observed ROM | none | validation study per joint/movement |
| Push/email reminders | in-app banner + .ics only | FCM + Cloud Functions (Blaze), consent for notifications |
| Clinician onboarding | admin script | admin UI, licence verification, audit log of grants |
| Invitation delivery | patient tells clinician manually | email via Cloud Functions/Trigger Email extension |
| Large histories | latest 1000 records per collection, client-side filtering | server-side pagination and range queries |
| Offline use | none (in-memory cache by design) | consider persistent cache with encryption trade-offs |
| 3D model | procedural mannequin | licensed anatomical model if anatomical detail is needed |
| Accessibility audit | keyboard navigation, labels, contrast tokens, reduced motion | formal WCAG 2.2 AA audit with assistive-technology users, including older adults |
| Localisation | English only (as specified) | translations, locale-specific formats |
| Monitoring | none | error reporting (e.g. Sentry), uptime, Firestore usage alerts |
| Dependency advisory | grpc-js (Node-only path) | update Firebase when fixed |

## Known limitations

- Association analysis uses a simple nearest-time pairing within ±2 h and Spearman correlation; repeated measures are treated as independent (stated in the UI).
- Mean angle is a simple sample mean (not time-weighted); irregular sampling can bias it slightly (quality indicators are shown).
- Calibration "static reference" is metadata only; it does not correct angles.
