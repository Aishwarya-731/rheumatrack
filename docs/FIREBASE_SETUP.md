# Firebase setup — from scratch

You do **not** need any of this for local development: `npm run dev:local` runs Auth and Firestore emulators with project ID `demo-rheumatrack` (the `demo-` prefix means no real Google resources are ever touched).

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `rheumatrack-prod`). Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
   - Settings → **User actions**: keep *Email enumeration protection* on.
   - Settings → **Password policy**: require ≥ 8 characters, lowercase/uppercase or numeric as you prefer (the app requires a letter and a digit).
3. **Build → Firestore Database → Create database** → *Production mode* → choose a region close to your users (cannot be changed later; consider data-residency requirements).
4. **Project settings → General → Your apps → Web (</>)** → register an app (Hosting can be enabled here). Copy the config values.
5. **Authentication → Settings → Authorized domains**: add your custom domain if you use one (`*.web.app` is added automatically).

## 2. Configure the app

```bash
cp .env.example .env.local
# fill VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
# (storage bucket and messaging sender ID are optional)
npm run dev          # runs against the real project
```

## 3. Deploy rules, indexes and hosting

```bash
npx firebase login
npx firebase use --add            # select the project, alias e.g. "prod"
npm run test:rules                # verify the rules first (needs Java)
npm run deploy                    # = npm run build && firebase deploy --only hosting,firestore
```

Open `https://<project-id>.web.app` and confirm sign-up, a check-in and an import work. Deployment is not complete until you have checked the deployed site.

## 4. App Check (recommended)

1. Google Cloud console → **reCAPTCHA Enterprise** → create a *website* key for your domains.
2. Firebase console → **App Check** → register the web app with *reCAPTCHA Enterprise* and that key.
3. Put the key in `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_KEY`, rebuild and deploy.
4. Watch App Check metrics, then click **Enforce** for Cloud Firestore and Authentication.

## 5. Grant clinician roles

**Option A — Firebase console (no key file needed, easiest).** The console bypasses Security Rules, so it can write the role document that clients never can.

1. The physician signs up in the app (any email) and, in Settings, clicks **Verify email** and opens the link.
2. Firebase console → **Authentication → Users** → copy the physician's **User UID**.
3. **Firestore Database → Data → Start collection** (or open `roles`) → Collection ID `roles` → **Document ID = the UID** → add field `role` (type *string*) = `clinician` → Save.
4. The physician signs out and back in; the sidebar now shows **Patients**.
5. To revoke: delete that document (and any `shares` documents with their `clinicianUid`).

**Option B — Admin script (scriptable, also removes shares on revoke):**

1. Firebase console → Project settings → **Service accounts → Generate new private key**. Save it **outside** the project folder. Never commit it or put it in a `VITE_` variable.
2. The clinician signs up in the app and verifies their email.
3. Run:
   ```bash
   # macOS/Linux
   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/key.json npm run grant-clinician -- --project <project-id> doc@example.com
   # Windows PowerShell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\key.json"; npm run grant-clinician -- --project <project-id> doc@example.com
   ```
4. The clinician signs out and in. Revoke with `--revoke` (also removes all their shares).

## Backups and retention

- **Backups:** enable **Firestore Point-in-time recovery** (7-day window) and scheduled backups (`gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d`), or periodic exports to a Cloud Storage bucket (`gcloud firestore export gs://<bucket>`). Backups/PITR require the Blaze (pay-as-you-go) plan. Test a restore before relying on it.
- **Retention:** records are kept until the user deletes them (per record, synthetic data, or the whole account in Settings). Define and publish a retention policy (e.g. delete inactive accounts after N years) — not implemented automatically.
- **Deletion and backups:** deleted records remain in backups until those expire; state this in your privacy notice.
- **Data export:** users can export CSV/JSON at any time (Reports & export).

## Cost notes

The Spark (free) plan covers Auth, Firestore and Hosting for small-scale use. Each imported session writes 1 + ⌈samples/5000⌉ documents; each session view reads its chunks.
