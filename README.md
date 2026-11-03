# AppByAhmad — Life OS (iOS, Android + Admin)

> **Tell us the life you want. We'll help you build it.**

This folder holds the whole product:

| Folder | What it is | Built with |
|---|---|---|
| `mobile/` | The iPhone and Android app (one codebase) | Expo + React Native + Expo Router |
| `server/` | The API the app talks to, **plus the admin dashboard** at `/admin` | Node.js, Express, PostgreSQL, React (admin) |
| `designs/` | Source of the 14 designed screens (male + female themes) | Design canvas |
| `docs/` | Product plan, non-coder setup guide, screenshots | |
| `render.yaml` | One-click hosting on Render (API + admin + database) | |

---

## What works today (milestone 1)

**Phone app**
- Welcome, create account, sign in (token stored in the phone's secure keychain)
- Onboarding: name → **pick your look** (Male = Black + Green, Female = Black + Maroon,
  Prefer not to answer = White + Black; the screen recolors live) → body basics (optional) → work and aspirations
- **Today** (Daily Command Center): greeting, animated Life Score ring, today's tasks from every goal, tick off tasks, add your own task
- **Goals**: create a goal → the app builds a plan (milestones + this week's tasks) with AI, or a built-in template when AI is off; roadmap, progress, pause, complete, delete
- **Journal**: mood, private entry (encrypted on the server), search, delete
- **Progress**: Life Score, consistency and goals rings, per-goal progress
- **Settings**: change theme anytime, sign out, **delete account** (required by Apple and Google)
- **Life** and **Assistant** tabs show what's coming next (Money, Fitness, Nutrition, Career, Future Me, Decisions, Assistant chat)
- Animations everywhere: cards slide up, rings and bars fill, numbers count up, main buttons glow

**Admin dashboard** (`/admin`, admins only)
- **Overview**: total users, active today / 30 days, Premium, onboarding rate, active goals, tasks done, journal activity, AI tokens; 30-day sign-ups chart; theme and goal-category breakdowns
- **Users**: search, filter by plan / status / role, pagination
- **User detail**: profile, goals, activity; **Give / remove Premium**, **suspend / reactivate**, **make / remove admin** (with confirmations)
- **AI usage**: tokens per day, by feature, top users (to watch cost)
- **Audit log**: every admin action and account deletion
- Dark and light mode, works on a phone screen
- Privacy: admins never see journal text or body measurements

**Server rules**
- Free plan: 1 active goal, 3 AI plans per month (change with `FREE_ACTIVE_GOALS`, `FREE_AI_PLANS_PER_MONTH`)
- Premium: unlimited (set by an admin for now; App Store / Google Play purchase comes with RevenueCat)
- Suspended users are blocked immediately; rate-limited sign-in; all input validated

---

## Try it on your computer

You need [Node.js 20+](https://nodejs.org) and PostgreSQL (or a free database from Render / Neon / Supabase).

```bash
cd server
```

```bash
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters). Then:

```bash
npm install
```

```bash
npm run build
```

```bash
npm run dev
```

- API: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin
- Optional fake data for the dashboard: `npm run seed:demo`
- Tests: `npm test` (needs a separate test database, see `test/helpers.js`)

### See the app on your phone

```bash
cd mobile
```

```bash
npm install
```

```bash
EXPO_PUBLIC_API_URL=http://YOUR-COMPUTER-IP:3000 npx expo start
```

Scan the QR code with **Expo Go** (iPhone camera, or the Expo Go app on Android).
Use your computer's local IP (not `localhost`) so the phone can reach the API.

---

## Put it online (Render)

1. This repository is already on GitHub.
2. Render → **New → Blueprint** → pick the repository. It creates the API + admin and the database.
3. When Render asks, fill in `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters) and, optionally, `ANTHROPIC_API_KEY`. The security keys are generated for you.
4. Open `https://<your-service>.onrender.com/admin` and sign in.
5. Put that URL in `mobile/eas.json` (`EXPO_PUBLIC_API_URL`) for store builds.

## Build for the App Store and Google Play

From `mobile/`, after creating an Expo account and the Apple / Google developer accounts:

```bash
npx eas-cli@latest build --platform all --profile production
```

```bash
npx eas-cli@latest submit --platform all
```

The bundle IDs are `com.htec.appbyahmad` (change them in `mobile/app.json` before the first store build if you want a different one).

---

## What's next (milestone 2)

1. **Adaptive goals**: weekly "What happened?" check-in and plan adjustments you approve
2. **Money**: income, expenses, savings goals, projections
3. **Fitness + Nutrition**: workout plans, logging, calories and macros, Apple Health / Health Connect
4. **Push notifications** with frequency controls
5. **Premium purchase** via RevenueCat + ads on the free plan (never on sensitive screens)
6. **Weekly Life Review**, **Career**, **Future Me**, **Decision Assistant**, **Assistant chat**
7. Admin: push broadcasts, feature flags, content management, revenue charts once payments are live
