# Training Plan Tracker

A small private training app for combined running and strength plans. The interface is hosted on GitHub Pages; Google sign-in and Firestore provide account access, synced check-offs, notes, profiles, history, and aggregate statistics.

## What is included

- One active plan per member, with archived and completed history.
- Weekly run/strength checklist, real dates, mileage overrides, progress, and notes.
- Optional one-click Google Calendar sync with links back to each training day.
- Private profiles with opt-in aggregate sharing.
- Owner-only invitation and template administration.
- Strict, versioned JSON imports plus a copyable AI-generation prompt.
- The complete eight-week base-building plan from the supplied reference HTML in [`public/examples/base-building-plan.json`](public/examples/base-building-plan.json).
- Firebase security rules and tests.
- GitHub Pages deployment workflow.

## Local setup

Requirements: Node.js 22+ and pnpm 11+.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Without Firebase values the app opens a fully interactive demo preview. This is useful for design review; demo changes are intentionally disposable.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. In **Authentication → Sign-in method**, enable Google.
3. Create a Firestore database.
4. Copy `.env.example` to `.env.local` and add the Firebase web configuration.
5. In Firestore, create `admins/{your Firebase Authentication UID}` with a string field named `role` and value `owner`.
6. Copy `.firebaserc.example` to `.firebaserc` and insert the Firebase project ID.
7. Deploy the rules:

```bash
pnpm firebase deploy --only firestore:rules,firestore:indexes
```

8. Add `localhost`, your `username.github.io` domain, and any custom domain to Firebase Authentication's authorized domains.

The Firebase web configuration is not a server secret. Owner identity lives in the private `admins` collection rather than the app bundle. Access is enforced by Authentication and `firestore.rules`. Never add an Admin SDK service-account key to this repository or the browser app.

## First use

1. Sign in with the configured owner account. The owner is a normal athlete account and also sees **Admin**.
2. Add invited Google email addresses in **Admin → Invited members**.
3. Use **Copy AI prompt**, fill in the training requirements, and paste the AI's JSON response into the importer.
4. Validate and publish the template. The supplied base-building example can also be loaded with one click.
5. Open **Plans**, select a Monday, and start the plan.

Template copies are snapshots. Editing or archiving a shared template never rewrites a member's existing training plan.

## Google Calendar setup

Calendar sync reuses the existing Firebase Google sign-in and requests the narrow `calendar.app.created` scope only when a member presses **Connect & sync**.

1. In the Google Cloud project connected to Firebase, open **APIs & Services → Library** and enable **Google Calendar API**.
2. Open **Google Auth Platform → Data Access** and add `https://www.googleapis.com/auth/calendar.app.created`.
3. Confirm the OAuth web client allows `http://localhost:5173`, `http://127.0.0.1:5173`, and `https://johnzwiss.github.io` as authorized JavaScript origins. Origins do not include the `/fazi-kros/` path.
4. While the OAuth app is in Testing, add each invited member as an OAuth test user.

Google access tokens stay in browser memory and are never stored in Firestore. Sync is user-triggered; the app creates a dedicated secondary calendar and cannot inspect or edit unrelated calendars.

## Firestore model

```text
allowedEmails/{normalizedEmail}
admins/{uid}
templates/{templateId}
users/{uid}
  plans/{planId}
    workouts/{workoutId}
    weeks/{weekNumber}
sharedProfiles/{normalizedEmail}
```

The owner can manage invitations and templates but cannot read another member's private `users/{uid}` tree. Members cannot create or edit admin records. `sharedProfiles` contains only fields a member explicitly opts into sharing.

## Tests

```bash
pnpm test
pnpm build
pnpm test:rules
```

The rules test starts the Firestore emulator and may require Java 11 or newer. GitHub runs it in a separate security-rules workflow so an emulator issue cannot block the Pages deployment.

## GitHub Pages deployment

1. Create a GitHub repository (for example, `fazi-kros`) and push this project to `main`.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. In **Settings → Secrets and variables → Actions → Variables**, add every `VITE_*` value from `.env.example` except `VITE_BASE_PATH`.
4. Push to `main` or run **Test and deploy to GitHub Pages** manually.

The workflow calculates the repository-relative base path, runs unit tests and a production build, then deploys `dist/` to Pages.
