# Symptom scale, analytics and reminders

## Symptom scale (`src/domain/symptoms.ts`)

- Pain, stiffness and discomfort are each rated on an 11-point numeric rating scale: **0 = none, 5 = moderate, 10 = worst imaginable**. Whole numbers only.
- Duration of stiffness or discomfort: whole minutes, 0–1440, or not reported.
- Notes: up to 2000 characters. Assessment time: local date/time, not more than 5 minutes in the future.
- Scores are stored exactly as entered. They are **not** summed, weighted, converted into a risk score, or interpreted diagnostically.
- Each check-in is a separate record; editing changes that record only (with `updatedAt`), and creating a new check-in never overwrites an earlier one.

## Dashboard figures (`src/domain/analytics.ts`)

All derived from the signed-in user's records in the selected date range (7/30/90 days or all):

| Card / chart | Definition |
|---|---|
| Movement sessions | count of sessions whose start time is in range; sparkline = sessions per local day, last 14 days |
| Joints tracked | distinct joint+side pairs with any session or check-in in range |
| Latest observed ROM | ROM of the most recent session in range |
| Symptom check-ins | count of check-ins in range |
| ROM trend | one point per session for the selected joint/side/movement |
| Symptom trend | pain/stiffness/discomfort per check-in for the selected joint/side |
| Left/right comparison | latest ROM per side, **only** for joint+movement pairs recorded on both sides |
| Joint comparison | per joint side: session count, latest ROM, check-ins, latest pain |

With no records, empty states are shown instead of numbers. Synthetic records are labelled and included until removed (Settings → Remove all synthetic data).

## Symptom ↔ ROM association (`src/domain/correlation.ts`)

1. **Pairing:** for one joint + side + movement, each check-in is paired with the session whose start time is closest, if within **±2 hours**. Candidate pairs are matched greedily by smallest time difference; each check-in and each session is used at most once. Unpaired records are excluded.
2. **Statistic:** Spearman rank correlation ρ (ties get average ranks) between observed ROM and the chosen symptom score. Chosen because symptom scores are ordinal and no linear relationship is assumed.
3. **p-value:** two-sided, Student-t approximation `t = ρ·√((n−2)/(1−ρ²))`, n−2 df. Reported as approximate; not adjusted for multiple comparisons.
4. **Shown only if** n ≥ 10 pairs and both variables vary. Otherwise the UI states why no value is shown.
5. **Limitations shown in the UI:** correlation is not causation; repeated measures from one person are not independent; time of day, activity, medication and recording conditions can confound both values.
6. Strength labels (negligible < 0.1 ≤ weak < 0.3 ≤ moderate < 0.5 ≤ strong) describe the coefficient only.

## Reminders (`src/domain/reminders.ts`)

Settings: enabled, time (HH:MM), weekdays, IANA timezone (default: the browser's). Stored in the user profile.

Delivery mechanisms that exist and are tested:
- **In-app banner** while RheumaTrack is open: appears when a scheduled time in the last 24 h has passed and no check-in has been saved since; re-evaluated every minute; can be dismissed per occurrence.
- **Calendar file (.ics):** weekly recurring event with an alarm at the chosen time and timezone. Importing it into a calendar app makes that app deliver the reminder.

Not implemented: push notifications or email (would require Firebase Cloud Messaging + Cloud Functions on the Blaze plan). The UI says so.
