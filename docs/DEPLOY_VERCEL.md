# Deploying the frontend on Vercel

Vercel hosts the static React build. **Firebase still provides Authentication and Firestore**, and the Firestore Security Rules are still deployed with the Firebase CLI. `vercel.json` (in the repo) sets the build, the SPA rewrite and security headers.

## Prerequisites
- The Firebase project from [FIREBASE_SETUP.md](FIREBASE_SETUP.md) steps 1–3 (Auth enabled, Firestore created, rules deployed with `npx firebase deploy --only firestore`).
- The code pushed to a GitHub repository (see the step-by-step guide PDF, “Push to GitHub from VS Code”).

## Steps
1. <https://vercel.com> → sign up/in with GitHub → **Add New… → Project** → **Import** your `rheumatrack` repository.
2. Framework preset: **Vite** (detected). Build command `npm run build`, output directory `dist` (also set in `vercel.json`). Root directory: the folder containing `package.json`.
3. **Environment Variables** (Production and Preview): add every `VITE_FIREBASE_*` value from your `.env.local`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (+ optional `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_APPCHECK_RECAPTCHA_ENTERPRISE_KEY`).
   **Do not** add `VITE_USE_EMULATORS` or any service-account key.
4. **Settings → General → Node.js Version: 22.x** (or 24.x).
5. **Deploy.** Note the URL, e.g. `rheumatrack-abc.vercel.app`.
6. Firebase console → **Authentication → Settings → Authorized domains → Add domain** → the Vercel domain (and your custom domain, if any). Without this, password-reset and verification links will not return to your site.
7. If App Check is used, add the Vercel domain to the reCAPTCHA Enterprise key's allowed domains.
8. Open the Vercel URL and test: sign up, check-in, import, share, sign out, sign in, reload a deep link such as `/history` (must not 404 — handled by the rewrite).

Every `git push` to the main branch redeploys automatically; pull requests get preview URLs (add their domains to Authorized domains if you sign in on previews).

Rule changes are **not** deployed by Vercel — after editing `firebase/firestore.rules`, run `npm run test:rules` then `npx firebase deploy --only firestore`.
