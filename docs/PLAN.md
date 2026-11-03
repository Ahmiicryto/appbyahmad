# H.TEC Life OS — iOS & Android App Plan

Source: *H.TEC Second SaaS, Product Vision & Feature Requirements* (24 sections + 12 screen mockups).

> **"Tell us the life you want. We'll help you build it."**
> One personal life operating system — goals, money, fitness, career, journal and an AI assistant that all share one memory of the user.

---

## 1. Recommended approach (one codebase, two stores)

| Layer | Choice | Why |
|---|---|---|
| **Mobile app** | **React Native + Expo (TypeScript)**, Expo Router, EAS Build/Submit | One codebase ships to iOS and Android. The team already works in JavaScript/React (this repo's portal), so there is no new language to learn. EAS builds iOS without owning a Mac for CI, and OTA updates let us fix JS bugs without a store review. |
| UI | NativeWind (Tailwind) + a small design-token theme system, Reanimated, Victory Native / Skia for rings and charts | The mockups are dark, ring/progress-heavy dashboards; Skia renders them at 60fps. Tokens make the 3 themes a single switch. |
| Local data | TanStack Query + MMKV, SQLite (expo-sqlite) for offline cache | Today screen and Journal must open instantly and work offline. |
| **Backend API** | **Node.js (TypeScript) + Fastify/Express**, **Postgres** (+ `pgvector`), Redis + BullMQ workers | Same stack the team runs today on Render; workers handle reminders, weekly reviews and plan recalculation. |
| Auth | Supabase Auth or Clerk (email, Apple, Google sign-in) | **Sign in with Apple is mandatory** on iOS if any social login is offered. |
| **AI** | Claude API via a server-side "AI orchestrator" — a fast, cheap model for plan generation, classification and summaries; a stronger model for the Assistant and Decision Assistant | Keys never ship in the app; per-user quotas enforce Free vs Premium limits. |
| Payments | **RevenueCat** on top of App Store / Google Play billing | Apple and Google require in-app purchase for digital subscriptions. RevenueCat handles receipts, trials, cross-platform entitlement and paywall A/B tests. |
| Ads (Free plan) | Google AdMob (+ UMP consent, iOS App Tracking Transparency prompt) | Ads are blocked by an allow-list of screens, never shown on Journal, feelings or sensitive finance screens. |
| Notifications | Expo Notifications (APNs + FCM), scheduled by the backend | Personalized, frequency-controlled reminders (section 19). |
| Health data | Apple HealthKit + Android Health Connect | Steps, weight, workouts (section 9) without manual entry. |
| Content | Exercise database with licensed demo videos/GIFs; USDA FoodData Central / Edamam for nutrition | Exercise demos and recipes need a licensed source. |
| Analytics / quality | PostHog or Amplitude, Sentry, Expo Updates | Funnel (onboarding → first goal → day-7 retention → paywall). |
| Hosting | Render (API, worker, Postgres, Redis) — same as the current platform | Reuses existing deploy knowledge (`render.yaml`). |

**Alternative considered:** Flutter. Equally good for performance, but would mean learning Dart and sharing no code with the existing React web portal. Native Swift + Kotlin would double the cost and is not needed for this kind of app.

---

## 2. The core idea in architecture terms: "everything is connected"

Sections 3 and 18 are the heart of the product. The design that makes them work:

```
              ┌──────────────────────── Personal Memory (single source of truth) ───────────────────────┐
              │ profile · body metrics · income/expenses · schedule · preferences · Future Me targets · history │
              └───────────────▲─────────────────────────────────────────────────────────────▲────────────┘
                              │ read                                                         │ write
  ┌──────────┬──────────┬─────┴────┬──────────┬──────────┬──────────┬──────────┐      domain events
  │  Goals   │  Money   │ Fitness  │Nutrition │  Career  │ Journal  │Future Me │  ─────────────────────▶  Event bus (BullMQ)
  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────────┴────┬─────┘   income.changed           │
       │          │          │          │          │                     │         weight.logged            ▼
       └──────────┴──────────┴────┬─────┴──────────┴─────────────────────┘         schedule.changed   Recalculation workers
                                  ▼                                                futureMe.updated    · savings projections
                      Unified Task table (source = goal/fitness/finance/career)    task.missed         · fitness & nutrition targets
                                  ▼                                                                    · goal plans (propose changes)
                      Today / Daily Command Center · End-of-day · Weekly Review · Life Score · Assistant
```

Rules:

1. **One profile, asked once.** Every module reads height, weight, income, schedule etc. from the Memory tables. No module has its own copy.
2. **One task table.** Every module writes daily items into `tasks` with a `source` and `goal_id`, so Today automatically merges "Push workout", "Review spending" and "Apply to 2 jobs".
3. **Change → event → recalculation.** Updating income emits `income.changed`; a worker recalculates savings projections and affected goal deadlines. Weight change re-targets calories/macros. Future Me edits update linked goals.
4. **Major changes need approval.** Workers write *proposals* ("Next week: 3 workouts × 45 min") that the user approves or rejects (section 5). Minor numbers (projections) update silently.
5. **AI reads a compact "user context"**, not the whole database: a server-built summary of profile, active goals, this week's progress and relevant module data, so each AI call is cheap and consistent.

### Core data model (first cut)

`users`, `profiles` (name, DOB, height, weight, units, currency, timezone, gender, theme, occupation, self_word, aspiration), `memory_facts` (key/value + source + updated_at for anything else learned), `goals` (title, category, current, target, unit, deadline, reason, status, progress), `milestones`, `plan_periods` (monthly/weekly), `tasks` (date, title, source, goal_id, priority, status, duration), `checkins` (daily review, weekly review, "what happened?" reasons), `plan_proposals`, `finance_accounts`, `budgets`, `transactions`, `savings_goals`, `workout_programs`, `workout_sessions`, `exercise_sets`, `body_metrics`, `nutrition_plans`, `meals`, `career_roadmaps`, `job_applications`, `journal_entries` (encrypted), `decisions` (options, factors, scores), `future_me_targets`, `life_scores`, `notifications_prefs`, `subscriptions`, `ai_usage`.

---

## 3. Screen map (matches the 12 mockups and section 20 navigation)

Bottom tab bar has room for 5 items on phones, so the 8 sections are grouped:

| Tab | Contains |
|---|---|
| **Today** | Daily Command Center, "Start My Day", End-of-Day Review, daily check-in |
| **Goals** | Goal list, goal roadmap (milestones/weekly/daily), Adaptive Goals proposals, **Future Me** |
| **Life** (hub) | Money, Fitness, Nutrition, Career, Decision Assistant |
| **Progress** | Weekly Life Review, monthly report, Life Score, "Build My Next Week" |
| **Assistant** | Chat with the personal assistant (+ quick prompts) |

Journal is reachable from Today (mood card) and the Life hub; Profile/Settings from the avatar. This keeps the eight areas from section 20 while staying usable on a phone. (If H.TEC wants all 8 as tabs, use a 5-tab bar with a "More" tab.)

---

## 4. Delivery plan

Estimates assume a small team: 2 React Native devs, 1 backend dev, 1 designer (part-time), 1 QA (part-time), product owner from H.TEC.

### Phase 0 — Discovery & design (3 weeks)
- Finalize the feature list per plan (Free vs Premium matrix), success metrics, target markets/languages/currencies.
- High-fidelity Figma from the 12 mockups + design tokens for the 3 themes; clickable prototype; test onboarding with 5–8 target users.
- Architecture decisions, data model, AI prompt design and cost model; App Store / Play developer accounts, bundle IDs, privacy policy and terms drafts.

### Phase 1 — MVP foundation (≈10 weeks) → internal beta
1. Project setup: Expo app, API, DB migrations, CI (EAS), Sentry, analytics, environments.
2. Auth (email, Apple, Google), account deletion, data export.
3. **Onboarding** (section 2) + theme selection + **Personal Memory** (section 3).
4. **Goal System** (section 4): create → AI-generated plan (milestones, monthly/weekly/daily tasks) → edit/pause/cancel/complete, notes, progress.
5. **Daily Command Center** (section 6) with the unified task feed + "Start My Day".
6. **End-of-Day Review** (section 7) with a note.
7. **Journal** (section 11): write, mood, history, search, delete; encrypted at rest; optional Face ID / fingerprint lock.
8. **Money basics** (section 8): income, expenses by category, savings goals, dashboard, "reach in 19 months" projections.
9. **Notifications** (section 19) with frequency controls and quiet hours.
10. **Subscriptions**: RevenueCat paywall, Free limits (1 active goal, AI quota), AdMob on allowed screens only.

### Phase 2 — Adaptive engine, Fitness & Nutrition (≈8 weeks) → public launch v1.0
- **Adaptive Goals** (section 5): missed-task detection, "What happened?" flow, AI proposals, approve/reject.
- **Fitness** (section 9): profile questions, weekly program, daily workout player (sets/reps/rest timer/demos), logging, HealthKit/Health Connect steps & weight, progressive overload.
- **Nutrition** (section 10): calories/macros from goal + body data, meal plan, swap meal, recipes, grocery list.
- **Weekly Life Review** (section 15) with patterns + "Build My Next Week".
- **Progress Dashboard & Life Score** (section 16), framed as progress/consistency, never worth.
- Cross-module events (section 18) live for income, weight, schedule and Future Me changes.
- Store launch: App Store + Google Play listings, screenshots, privacy labels / Data Safety form, review submission.

### Phase 3 — Career, Decisions, Future Me, Assistant (≈8 weeks) → v1.5
- **Career Guide** (section 12): target role → roadmap, skill-gap analysis, résumé builder (PDF export), AI interview practice, job application tracker, salary research, certifications, networking goals.
- **Decision Assistant** (section 13): options vs factors matrix, weighted scoring, recommendation using saved profile/goals/finances.
- **Future Me** (section 14): "December 2027 Me" builder, links each target to goals, "You are 43% of the way" progress, vision image.
- **Personal Assistant** (section 17): chat with tool access ("change my workout to 30 min", "can I afford this?") that reads and — with confirmation — writes to modules.
- Monthly progress reports.

> Future Me and the Assistant are called "main features" in the spec. If they matter for launch marketing, a **basic Future Me** (targets + % progress) and an **Assistant v0** (Q&A over the user's data, no writes) can move into Phase 2 at ~2 extra weeks.

### Phase 4 — Growth & scale (ongoing)
Suggested features below, A/B tests on the paywall, localization, performance and AI-cost tuning.

**Total to a feature-complete v1.5: ≈ 7 months.** MVP in the stores (Phases 0–2): ≈ 5 months.

---

## 5. Free vs Premium enforcement

| Capability | Free ($0) | Premium ($12.99/mo) |
|---|---|---|
| Active goals | 1 | Unlimited |
| AI goal planning / adaptive changes | 1 plan, no adaptive proposals | Full |
| Assistant messages | ~10 / week | Fair-use unlimited |
| Today / EOD review | Basic (goal tasks only) | Full (all modules merged) |
| Journal | Full write/history (keep it free, it builds habit) | + lock, export |
| Weekly Review | Scores only | Full insights + Build My Next Week |
| Money / Fitness | Dashboard, 1 savings goal / sample program | Full + Nutrition |
| Career, Future Me, Decision Assistant | Preview (locked cards) | Full |
| Ads | Yes, outside sensitive screens | None |

Entitlements are checked **on the server** (RevenueCat webhook → `subscriptions` table), not only in the app.

**Pricing recommendations:** add an **annual plan (~$79.99–$89.99/yr)** and a **7-day free trial** — annual plans dramatically improve retention for habit apps. Enroll in Apple's Small Business Program and Google's 15% tier to keep 85% of revenue. Consider regional pricing for emerging markets.

---

## 6. Gaps & risks found in the spec (with fixes)

| # | Issue | Recommendation |
|---|---|---|
| 1 | **Age** is used by Fitness (section 9) but onboarding (section 2) never asks it. Units, currency and timezone are also missing. | Add date of birth, unit system (kg/lb, cm/ft), currency and timezone to onboarding (auto-detect the last three). |
| 2 | **Theme tied to gender** (green / maroon / white). Some users will dislike being assigned a colour by gender. | Use gender only to pick the *default* theme, and let users change theme anytime in Settings (and offer a theme picker step in onboarding). |
| 3 | Onboarding has many questions; long onboarding kills conversion. | Ask only name, goal, gender/theme, units in the first minute; collect height/weight/income **just-in-time** when the user first opens Fitness or Money (still saved once to Memory). The mockup's "Tell us about your life" checklist supports this. |
| 4 | **Health & finance data + ads.** Apple forbids using HealthKit data for advertising; ads need ATT consent on iOS and GDPR consent in the EU/UK. | Never pass health/finance data to the ad SDK; non-personalized ads by default; strict screen allow-list. |
| 5 | **App Store requirements**: in-app account deletion, Sign in with Apple, privacy nutrition labels, Play Data Safety form, subscription terms on the paywall. | Built into Phase 1 scope. |
| 6 | **Advice liability** — finance (section 8 already notes this), fitness/nutrition (medical), journal (mental health). | Clear disclaimers; safe calorie floors and injury screening; even though v1 doesn't analyze the journal, show crisis-support resources in Journal settings. |
| 7 | **AI cost** can exceed revenue on Free users. | Per-user quotas, cheaper model for routine generation, caching of plans, server-side "user context" summaries instead of sending full history. |
| 8 | **Journal privacy** is a trust issue. | Encrypt entries at rest, exclude journal from AI by default (opt-in later), biometric lock. |
| 9 | 8 nav items don't fit a phone tab bar. | Grouping in section 3 above. |

---

## 7. Suggested new features

Prioritized by impact vs effort. ★ = strong Premium upsell.

### High impact, should be planned early
1. **Bank & card sync** ★ (Plaid / TrueLayer / regional open-banking) — automatic, categorized spending instead of manual entry; makes "Spending was $18 above target" real-time.
2. **Calendar sync** (Google / Apple / Outlook) — reads busy slots so Today and "Build My Next Week" schedule tasks into free time; handles "my schedule changed" automatically.
3. **Home-screen & lock-screen widgets + Live Activities** — today's 3 priorities, Life Score ring, workout rest timer on the lock screen. Huge for daily retention.
4. **"Life happened" mode** — one button for *Sick / Travelling / Exam week / Busy week* that pauses or lightens every plan at once and rebuilds afterwards (the cross-module version of section 5).
5. **Streaks with "streak freeze"** — consistency rewards that forgive one missed day, matching the "don't say you failed" philosophy.
6. **Voice check-ins & voice journaling** — speak the end-of-day review or journal entry; transcribed on-device.

### Engagement & growth
7. **Accountability partner** ★ — invite a friend/coach to see selected goals and nudge you; social accountability is the strongest habit driver.
8. **Challenges / programs** — "30-day savings sprint", "8-week first 5K", "Read 12 books"; prebuilt plans that auto-create goals and tasks.
9. **Shareable "Year/Month in Review"** cards (Spotify-Wrapped style) — organic marketing.
10. **Referral program** — give a friend 1 month Premium, get 1 month.
11. **Letters from Future Me** ★ — monthly AI-written message from the user's Future Me based on real progress; plus an AI-generated vision image.

### Smart tracking
12. **Receipt scan & meal-photo logging** ★ — camera OCR for expenses; photo-based calorie estimate for meals.
13. **Sleep & energy tracking** (from HealthKit/Health Connect or a 1-tap energy rating) — feeds the "your productivity drops after 8 PM" pattern detection.
14. **Focus timer (Pomodoro) linked to goal tasks** — tracks deep-work time per goal; can enable phone Focus / Do Not Disturb.
15. **Habit tracker** for small recurring actions (water, reading, meditation) that roll into goals.
16. **Subscription & bill radar** — detects recurring charges and reminds before renewals; flags unused subscriptions.

### Platform
17. **Apple Watch / Wear OS companion** — workout logging, rest timer, quick check-ins.
18. **Web dashboard** — same account, for planning sessions and résumé editing on a big screen.
19. **Offline mode** — Today, Journal and workouts work without internet and sync later.
20. **Localization** — multiple languages and currencies (including RTL languages if targeting the Middle East/South Asia).
21. **Family / Couple plan** — shared household budget and shared goals; a higher-priced tier.

---

## 8. Immediate next steps

1. H.TEC confirms: target countries & languages, launch scope (Phases 0–2), whether Future Me / Assistant must be in v1.0.
2. Create a dedicated repository for the app (this repo is the Shopify WhatsApp platform) — suggested monorepo: `apps/mobile` (Expo), `apps/api`, `packages/shared` (types, validation, theme tokens).
3. Register Apple Developer ($99/yr) and Google Play Console ($25 one-time) accounts; reserve the app name.
4. Start Phase 0 design sprint from the 12 mockups.
