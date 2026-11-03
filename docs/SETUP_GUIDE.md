# H.TEC Life OS — Setup Guide for Non-Coders

You do **not** need to write code. The work is split like this:

| Who | What |
|---|---|
| **You** | Create accounts, pay store fees, copy keys into a settings page, test the app on your phone, make product decisions. |
| **Claude (me)** | Write all the app code, database, AI prompts and store setup files; fix bugs you report; push everything to GitHub. |

Each step below says **what it is**, **why you need it**, **exactly what to do**, and **what to send back to me**.

> 🔐 **Never paste secret keys into the chat or into GitHub.** When a step gives you a *secret* key, put it in the place the step says (Expo / Supabase secrets). Public IDs (like a project URL) are fine to share.

---

## Part 0 — Start these today (they take days to approve)

### 0.1 Apple Developer Program — to publish on iPhone ($99 / year)
- **Why:** Required to put any app on the App Store.
- **Decide first: Individual or Organization?**
  - *Organization* (recommended): the store shows **"H.TEC"** as the seller. Needs a free **D-U-N-S number** for the company (request at <https://developer.apple.com/enroll/duns-lookup/> — can take 1–2 weeks) and a company website/email.
  - *Individual*: faster, but your personal name is shown as the seller.
- **Do:** Go to <https://developer.apple.com/programs/enroll/>, sign in with an Apple ID (turn on two-factor auth), enroll, pay.
- **Send me:** "Apple account approved" + your **Team ID** (Membership page).

### 0.2 Google Play Console — to publish on Android ($25 one-time)
- **Do:** <https://play.google.com/console/signup> → choose **Organization** if you have the D-U-N-S number, otherwise Personal. Complete identity verification.
- ⚠️ **Important:** new **Personal** accounts must run a **closed test with at least 12 testers for 14 days** before going public. Organization accounts skip this. If you go Personal, start collecting 12+ friends' Gmail addresses now.
- **Send me:** "Google account approved".

### 0.3 Company basics
- A **domain** and **support email** (e.g. `support@htec...`) — both stores require a support contact.
- A **privacy policy** and **terms of use** page (I will draft them; you host them on your website or I put them on a simple page).

---

## Part 1 — Tools to see the app on your phone (day 1, free)

### 1.1 GitHub (you already have it)
- Code lives here. I'll create a **new repository** for the app, e.g. `Ahmiicryto/htec-life-os` (with your OK).

### 1.2 Expo account — builds and previews the app
- **Do:** Sign up at <https://expo.dev/signup>. Create an organization named `htec`.
- **Send me:** your Expo **username / org name**.

### 1.3 Expo Go app on your phone
- Install **Expo Go** from the App Store / Google Play.
- When I finish a screen, you will scan a **QR code** and the app opens instantly on your phone — no store needed.
- Later (when we add payments, ads and health data) Expo Go can't run those parts; I'll then make a **"development build"** — you install it once from a link, same experience.

---

## Part 2 — Backend: database + login (week 1, free to start)

I recommend **Supabase** instead of writing our own server first: it gives the database, user login (email, Apple, Google), file storage and server functions with a simple dashboard you can look at. Less code = faster and cheaper.

### 2.1 Create Supabase project
- **Do:** <https://supabase.com> → sign up with GitHub → **New project**
  - Name: `htec-life-os`
  - Database password: generate a strong one and **save it in a password manager**
  - Region: closest to your users (e.g. Frankfurt / Mumbai / Singapore / US East)
- **Send me:** the **Project URL** (Settings → API). This is public and safe to share.
- **Do NOT send:** the `service_role` key or the database password.

### 2.2 Connect GitHub to Supabase (optional, recommended)
- Supabase → Project Settings → Integrations → GitHub → connect the app repo, so database changes I write are applied automatically.

### 2.3 Login providers (I'll guide you click-by-click when we get there)
- **Email:** on by default.
- **Sign in with Apple:** required by Apple if we offer Google login. Needs Apple account from 0.1.
- **Google:** needs a Google Cloud project (free).

---

## Part 3 — AI brain (week 2)

### 3.1 Anthropic (Claude) API
- **Why:** Goal plans, adaptive suggestions, weekly reviews, the Assistant, career roadmaps.
- **Do:** <https://console.anthropic.com> → sign up → **Billing**: add a card and a small credit (e.g. $20) → set a **monthly spend limit** → **API Keys → Create key** named `htec-life-os-prod`.
- **Where to put it:** Supabase → **Edge Functions → Secrets** → add `ANTHROPIC_API_KEY` = your key. (The key stays on the server, never inside the phone app.)
- **Send me:** "AI key added".

---

## Part 4 — Money: subscriptions and ads (before launch)

### 4.1 Store payment agreements
- **Apple:** App Store Connect → **Business** → accept the **Paid Apps Agreement**, add bank account and tax forms. Subscriptions won't work without this.
- **Google:** Play Console → **Set up a payments profile / merchant account**.

### 4.2 RevenueCat — manages the $12.99 Premium subscription (free to start)
- **Why:** Handles Apple and Google subscriptions in one place, free trials, and tells the app who is Premium.
- **Do:** <https://www.revenuecat.com> → sign up → create project `HTEC Life OS`. I'll send you click-by-click steps to link Apple and Google and create the products:
  - `premium_monthly` — $12.99 / month
  - `premium_yearly` — e.g. $89.99 / year (recommended)
  - 7-day free trial (recommended)
- **Send me:** the **public SDK keys** (one for iOS, one for Android — these are public and safe).

### 4.3 Google AdMob — ads for Free users
- **Do:** <https://admob.google.com> → sign up → add 2 apps (iOS + Android) → create a **Banner** and **Native** ad unit for each.
- **Send me:** the App IDs and ad unit IDs (public).
- Ads will only appear on allowed screens — never on Journal or sensitive money screens.

---

## Part 5 — Helpers (when the matching feature is built)

| Service | For | Cost |
|---|---|---|
| **Sentry** (sentry.io) | Tells us when the app crashes | Free tier |
| **PostHog** (posthog.com) | See how many users finish onboarding, upgrade, etc. | Free tier |
| **Exercise database** (e.g. ExerciseDB via RapidAPI) | Exercise demo videos/GIFs | Small monthly fee |
| **Edamam** or **USDA FoodData Central** | Calories & recipes | USDA free |
| **Figma** (optional) | If a designer refines the mockups | Free tier |

Apple HealthKit and Android Health Connect need no account — they're switched on in the code; you just answer the store's privacy questions.

---

## Part 6 — How we work together each week

1. You tell me what to build next (or I follow the plan in `PLAN.md`).
2. I write the code and push it to GitHub.
3. I publish an update → you open it in **Expo Go** (or the dev build) and test.
4. You tell me in plain words what's wrong: *"the Start My Day button doesn't save"*, a screenshot helps.
5. I fix it. Repeat.

Rough build order: Onboarding → Profile memory → Goals with AI plan → Today screen → End-of-day review → Journal → Money → Notifications → Paywall → Fitness → Nutrition → Weekly review → Career → Future Me → Decisions → Assistant.

---

## Part 7 — Publishing to the stores (≈ month 5)

I prepare the build and store files with **EAS** (Expo's build service). You:
1. **Apple:** App Store Connect → create the app → fill in description, screenshots (I generate them), privacy "nutrition label" (I give you the answers), age rating → submit. TestFlight first for beta testers.
2. **Google:** Play Console → create the app → store listing, **Data safety** form (I give you the answers), content rating → closed test → production.
3. Reviews usually take 1–3 days. If rejected, paste the reason to me and I fix it.

---

## Your checklist

- [ ] Apple Developer enrollment (Organization + D-U-N-S, or Individual)
- [ ] Google Play Console account
- [ ] Domain + support email
- [ ] Expo account + Expo Go on phone
- [ ] OK for Claude to create the GitHub repo `htec-life-os`
- [ ] Supabase project → send Project URL
- [ ] Anthropic API key → saved in Supabase secrets
- [ ] Paid Apps Agreement (Apple) + payments profile (Google)
- [ ] RevenueCat project → send public keys
- [ ] AdMob apps + ad units → send IDs

## Running costs (approximate, at the start)

| Item | Cost |
|---|---|
| Apple Developer | $99 / year |
| Google Play | $25 once |
| Expo, Supabase, RevenueCat, Sentry, PostHog | $0 on free tiers at first (Supabase Pro $25/mo when you launch) |
| Claude API | Pay per use — a few dollars during development; scales with users (limited for Free users) |
| Domain | ~$10–15 / year |
