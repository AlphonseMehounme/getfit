# GetFit App — Product Requirements Document v2

Nov 16, 2026 · @Alphonse Mehounme

GetFit is a responsive web app and PWA that unifies strength training and running in one structured, recovery-aware programme. This v2 supersedes the initial PRD: it keeps its vision and principles, fixes the data model so it can express the programme, records the product decisions taken on 16 Nov 2026, and replaces the roadmap with a five-phase plan where authentication, security and tests start in the foundation.

## 0. Document control

**Version:** 2.7 (D46–D48 added, 18 Nov 2026; D44–D45 added, 18 Nov 2026; D42–D43 added, 18 Nov 2026; D33–D41 added for Phase 2, 18 Nov 2026; D31–D32 added, 17 Nov 2026; D30 added, 17 Nov 2026; D20–D29 added for Phase 1, 16 Nov 2026) · **Status:** Approved for build · **Supersedes:** PRD v1 (initial product definition) · **Working name:** GetFit App

### What changed from v1

- Authentication, Row Level Security and automated tests move from the last phase into the foundation and every phase.
- Offline sync is designed into the data model from day one (client-generated IDs, idempotent writes), even though it ships in Phase 4.
- A basic manual running log ships with the core loop, because the Sunday long run is part of the programme.
- Prescriptions store a single target value (the upper bound of the original range).
- The schema gains programme links on sessions and runs, load, reps in reserve, substitutions, per-side flags and week-level volume adjustments.
- Explicit recovery rules for rescheduling, a defined "missed" moment and a Monday week start.
- Findings from the audit of the existing HTML prototype (section 4), including image-mapping defects.

### Decision log

| # | Decision | Detail | Decided |
| --- | --- | --- | --- |
| D1 | Single target value per prescription | Store only the maximum of each range as the target: "3 × 4–6" becomes 3 × 6; "30–45 s" becomes 45 s. The 2–3 reps-in-reserve rule still applies, so hitting the target is not required for a set to count. | 16 Nov 2026 |
| D2 | Reference run | 10.84 km in 1 h 19 min 30 s (4,770 s). Computed pace 440 s/km = 7:20 /km. Effort 7/10. | 16 Nov 2026 |
| D3 | Recovery rule — strength | No strength session on the calendar day after another strength session. | 16 Nov 2026 |
| D4 | Recovery rule — long run | No lower-body session within 48 hours before the long run. | 16 Nov 2026 |
| D5 | Week start | Weeks run Monday to Sunday for every user. | 16 Nov 2026 |
| D6 | Missed status | A scheduled session becomes "missed" at the end of its scheduled day (23:59:59) in the user's time zone, if not completed or partially saved. | 16 Nov 2026 |
| D7 | Delivery plan | Five phases (0–4) as in section 14, replacing both the v1 roadmap and the earlier four-phase proposal. | 16 Nov 2026 |
| D8 | Auth in foundation | Email/password auth and RLS are built in Phase 1; no mock data for authenticated users at any point. | 16 Nov 2026 |
| D9 | One session per day | At most one strength session or long run per day (BR-11). Prevents doubling up after a missed day. | 16 Nov 2026 |
| D10 | Moves stay in the week | A session can only be rescheduled within its Monday–Sunday week; otherwise it is skipped (BR-12). Keeps each week's load and the weekly review coherent. | 16 Nov 2026 |
| D11 | Deload | Week 5: sets × 0.65 rounded, minimum 1; long-run ceiling 7 km; reps unchanged (BR-17). Sits in the middle of v1's 30–40% range. | 16 Nov 2026 |
| D12 | Rest times and durations | Rest 120 s for pull-ups and chin-ups, 90 s for push and split-squat patterns, 60 s for accessories, 45 s for side plank; session estimates 40 / 45 / 30 min (section 7). | 16 Nov 2026 |
| D13 | Progression suggestions | Offered only when adherence ≥ 75%, average RPE ≤ 7, fatigue ≤ 3/5 and no pain; one change per week, +1 rep or long-run ceiling +10% at most; user must accept (BR-19). | 16 Nov 2026 |
| D14 | Late logging | A session can be logged against its scheduled day for up to 7 days afterwards (BR-7). | 16 Nov 2026 |
| D15 | Language | UI and content in French and English; language follows the browser, falls back to French, and can be changed in Settings. | 16 Nov 2026 |
| D16 | Name and accent | Product name GetFit. Brand accent cobalt (#2F5BEA light, #7B93FF dark), because green, amber and red are reserved for status. | 16 Nov 2026 |
| D17 | Tooling and hosting | next-intl, Serwist, Dexie, Sentry, PostHog; Supabase and PostHog in EU regions. | 16 Nov 2026 |
| D18 | Prototype images | The 10 usable prototype images are development placeholders only and are blocked from production builds. Production uses one commissioned set of original illustrations (section 8). | 16 Nov 2026 |
| D19 | Glute bridge reference photo | `pont-fessier-reference.jpg` is not used in the app; `pont-fessier.jpg` is the glute-bridge placeholder. | 16 Nov 2026 |
| D20 | Phase 1 enrolment and test clock | Phase 1 ships a minimal "Start programme" step (Start Monday / Start this week, BR-2) that Phase 2 onboarding wraps. A server clock override (`GETFIT_TEST_NOW`) is honoured only when `NODE_ENV=test` or `VERCEL_ENV=preview`; a production build fails if it is set. The first milestone is accepted by an E2E test logging Strength A on an injected Monday, plus a real-phone run logging the strength session scheduled that day. | 16 Nov 2026 |
| D21 | Set persistence before the outbox | Until the Phase 4 outbox, every set is upserted to the server as it is logged, with a client-generated UUID (idempotent), and an in-progress session resumes after reload. Phases 1–3 are online-only for logging; on-device persistence (BR-6) is completed in Phase 4. | 16 Nov 2026 |
| D22 | Rescheduling scope | For BR-9 to BR-11, blockers are sessions still scheduled plus logged sessions (partial or completed); skipped, missed and not-scheduled sessions do not block. Candidate dates run from today to Sunday of the session's week; past dates are never candidates. A `full` body focus counts as lower body for BR-10. | 16 Nov 2026 |
| D23 | Status timing | A day is missed from 00:00:00 local on the day after its scheduled date. The late-logging window (D14) closes at 23:59:59 local, 7 days after the scheduled date. A session still in progress after its day ends shows "in progress", not "missed", and can be resumed or saved as partial within the window. A session can be started only on its scheduled date or late within the window; an earlier date needs a reschedule. Not-scheduled days (BR-2) cannot be moved or logged. | 16 Nov 2026 |
| D24 | Recovery and rest content | Seven session templates: Strength A, B, C, Long run, Recovery, `rest-mobility` (Thursday: rest, optional mobility) and `rest-pre-run` (Saturday: no intense leg work, optional walk). Tuesday targets: easy walk 1 × 30 min, then hip, ankle and shoulder mobility at 1 × 3 min each (9 min, within "up to 10 min"). | 16 Nov 2026 |
| D25 | Long-run ceiling and deload rounding | The week's `long_run_ceiling_m` is authoritative for the long run; the template keeps 11,000 m as its base, and the seed is tested so that each week's ceiling = base × multiplier rounded down to a whole km. Deload rounding is half-up; durations, rest and per-side flags are unchanged in week 5. | 16 Nov 2026 |
| D26 | One fulfilment per programme day | Enforced by one partial unique index per table (`workout_sessions`, `running_sessions`) on (user_programme_id, programme_day_id) for partial or completed, non-deleted rows. Services refuse to link a workout to a run day or a run to a strength day. | 16 Nov 2026 |
| D27 | Placeholder media handling | Placeholders keep their native size and format, renamed `<slug>.jpg`; the 4:3, 1200 × 900 WebP checks apply only to `final` assets. Placeholders may declare licence `unknown-dev-only` (allowed only for `placeholder`), verified by AL in the 16 Nov 2026 audit. Fallback slugs carry `status: fallback` and no file; category fallbacks are listed separately, and until the commissioned set arrives they render as a category icon with "Illustration coming soon". Media QA rule 6 ships with the exercise library page (Phase 2); until then the milestone E2E checks Strength A's media. | 16 Nov 2026 |
| D28 | Exercise categories | Category is one of upper, lower, core, recovery, mobility, running (matching the six fallbacks), with an optional pattern (pull \| push) for display. | 16 Nov 2026 |
| D29 | Phase 1 scope details | A database trigger creates a minimal profile at sign-up (id, locale, time zone from the browser); `first_name` stays empty until onboarding. Test fixtures may use the service-role key to create and confirm test users, only inside test code. Sentry and PostHog (EU) are wired in Phase 1 so that events ship with each feature. Phase 1 builds only the design-system components the first milestone uses; others are built with the features that need them. | 16 Nov 2026 |
| D30 | Per-test clock in E2E | In addition to `GETFIT_TEST_NOW` (D20), an `x-getfit-test-now` request header overrides the server clock for that request, only when `NODE_ENV=test`, so each end-to-end test can pick its own day against one server. It is never honoured in development, preview or production. | 17 Nov 2026 |
| D31 | Finishing a workout | A workout can be saved as completed only when every prescribed set (both sides for per-side exercises, BR-16) has been logged as done, whatever the reps achieved (BR-14). With any set missing, it can only be saved as partial. Completion is still always the user's confirmed choice (BR-5). | 17 Nov 2026 |
| D32 | Reopening a partial workout | A workout saved as partial can be reopened, logged further and saved again as completed or partial, until its late-logging window closes (D14, D23). A completed workout is final. | 17 Nov 2026 |
| D33 | Linking a run to the long run | A run dated on the long run's current date (after overrides) is offered the link, and may be logged later within D14. A run on another date in the same Monday–Sunday week is offered "move the long run to this day and link", only if BR-9 to BR-12 allow that date; accepting writes a `moved` override. Otherwise the run is saved unlinked. A run never fulfils a strength day (D26), and one run fulfils one programme day. | 18 Nov 2026 |
| D34 | Pause is persisted | `workout_sessions.paused_at` holds the start of the current pause (null when not paused). Resuming adds the interval to `paused_s`; a reload mid-pause comes back paused, and elapsed time excludes the pause. Saving while paused closes the pause first. | 18 Nov 2026 |
| D35 | Settings in Phase 2 | Profile lets the user edit every onboarding answer (profile, goals, experience, equipment, availability, baselines) and set units, language, time zone (BR-4) and theme. Data export and account deletion stay in Phase 4. | 18 Nov 2026 |
| D36 | Availability is stored, not applied | Onboarding step 5 is pre-filled from the programme's days. Answers never move sessions. When they differ from the programme, the recommendation step and Settings say that the programme keeps its own days and that sessions can be moved within the week (BR-9 to BR-12). | 18 Nov 2026 |
| D37 | Phase 2 Today | Header (greeting, "Week n of 8 · label", programme progress ring), today card, week strip, "This week" (sessions done of scheduled, running distance, adherence) and the last 5 workouts and runs. In Phase 2 the attention card only reports a missed session with its options; "weekly review is ready" and the performance overview come in Phase 3. Programme progress = (completed + 0.5 × partial) ÷ training sessions scheduled in the whole programme. | 18 Nov 2026 |
| D38 | Changing a move or skip | A moved session can be moved again: its single override is updated and every candidate is checked again. A move or skip can be undone while nothing is logged for that day and its original date is today or later; undoing deletes the override. | 18 Nov 2026 |
| D39 | Rest timer and timed holds | Both are computed from an end time, so they stay correct across a screen lock. The rest timer starts after each set except the workout's last, from the prescription's rest, with Skip and +15 s. At zero it vibrates and plays a sound when the page is visible, or when the user returns to it; no push notifications in the MVP. Sound can be muted per device. Timer state stays on the device. The screen wake lock is held while a workout is open and not paused, where supported. | 18 Nov 2026 |
| D40 | Skip and substitute | Substitutes are the exercise's `substitute` relations in the same category, filtered to the user's equipment (the programme's required equipment if none is recorded). A substitute applies for the rest of the session, keeps the original prescription's target and slots, and is recorded with `substituted_for_exercise_id`. A skipped exercise leaves its sets unlogged, so the workout can only be saved as partial (D31). Skipping can be undone. | 18 Nov 2026 |
| D41 | Load and reps in reserve | Optional on every set, shown in the user's units; load stored in kg, RIR 0–10. Neither changes whether a set counts (BR-14). | 18 Nov 2026 |
| D42 | Bodyweight is always available | For substitutes (D40), an exercise qualifies when every item of equipment it needs is available; `bodyweight` always counts as available. No item implies another (`gym` does not imply a pull-up bar). | 18 Nov 2026 |
| D43 | Rest after both sides | For per-side exercises (BR-16), the rest timer (D39) does not start between the left and right side of a set; it starts after the right side. No rest after the workout's last prescribed set. | 18 Nov 2026 |
| D44 | A substitute is remembered through its sets | A substitute (D40) is recorded on each set logged with it (`substituted_for_exercise_id`); the active substitute for an exercise is the one on its latest logged set. A substitute chosen and not yet used for a set is not kept across a reload. | 18 Nov 2026 |
| D45 | No logging while paused | While a workout is paused (D34), no set can be logged; the user resumes first. | 18 Nov 2026 |
| D46 | A hold pre-fills; the user confirms | A timed hold's countdown (D39) never logs a set by itself. At zero it alerts and pre-fills the set with the target seconds; stopping early pre-fills the seconds held. The user taps to log. | 18 Nov 2026 |
| D47 | Rest starts on a set's first log | The rest timer (D39) starts only when a set is logged for the first time; correcting a logged set never starts or restarts it. | 18 Nov 2026 |
| D48 | A running rest survives a reload on the same device | The rest end time is kept in the browser's storage for that session, so a reload shows the remaining time. If storage is unavailable the rest is not restored. Nothing is sent to the server (D39). | 18 Nov 2026 |

## 1. Vision, principles and users

Every morning, a user opens GetFit and knows what to train today, why it is in the plan, how to perform it, what they have achieved and whether to push, maintain or recover. The goal is not to record workouts; it is to help people train better and progress measurably.

### Product principles

1. Training is structured, not improvised.
2. Progress is measurable.
3. Recovery is part of training.
4. Daily actions are effortless, especially on mobile mid-workout.
5. Users understand why a session is recommended.
6. Users own their data: full export and deletion.
7. The product never invents workout results, history or performance metrics. Unknown values are shown as unavailable, never as zero.

### Target users

| Profile | Needs | What GetFit must get right |
| --- | --- | --- |
| Beginner | Structured plan, clear demonstrations, guidance on sets, reps and rest | Onboarding, exercise media, rest timer, conservative defaults |
| Intermediate | Track performance, weekly and monthly plans, balance strength and endurance | Logging speed, progress charts, personal records |
| Hybrid athlete | Combine running and strength, monitor volume and fatigue, one history | Recovery rules, weekly review, unified timeline |

The launch persona is a hybrid athlete training at home with a pull-up bar and bodyweight (the reference profile in section 7).

## 2. Objectives and success metrics

The MVP succeeds if users complete scheduled sessions and come back for eight weeks. Each metric below has one definition, computed in the domain layer and nowhere else.

### MVP user outcomes

A user can: create an account and profile; set goals; start the 8-week programme; see what to do each day; learn every exercise through media; log strength sessions and runs; track progress; complete a weekly review; understand recovery and consistency; and access all of it on any device.

### Metric definitions

| Metric | Definition | Source events |
| --- | --- | --- |
| Weekly active users | Distinct users with at least one logged session or weekly review in a Monday–Sunday week | `workout_completed`, `running_session_logged`, `weekly_review_completed` |
| Weekly adherence | Completed scheduled sessions ÷ scheduled training sessions in the week (rest days excluded; partial counts as 0.5) | Schedule engine + sessions |
| Logging completion rate | Sessions completed ÷ sessions started | `workout_started`, `workout_completed` |
| Abandonment rate | Sessions started and not saved within 24 h ÷ sessions started | `workout_abandoned` |
| 4- and 8-week retention | Share of users active in week 4 and week 8 after `programme_started` | `programme_started` + activity |
| Programme completion | Share of users reaching week 8 with adherence ≥ 60% over the programme | Schedule engine |
| Progress review return | Share of weekly actives who open the Progress page | `progress_viewed` |

Targets are set after the beta baseline; the MVP ships the instrumentation, not the targets.

## 3. Scope

The MVP is a single-user training experience for one programme, with real persistence and offline logging. Everything in the second list is deferred but must not require a rewrite.

### In the MVP

| Module | Included |
| --- | --- |
| Authentication | Email/password registration, login, logout, password reset |
| Onboarding | Profile, goals, experience, equipment, availability, optional baselines |
| Dashboard | Today, weekly timeline, performance overview, recent activity |
| Programme | The 8-week hybrid programme, calendar, week navigation, rescheduling with recovery rules |
| Workout execution | Start, log sets, rest timer, skip, substitute, pause, partial save, finish with RPE |
| Running log | Manual entry, computed pace and speed, link to the Sunday long run |
| Exercise library | Searchable library with correctly mapped media and fallbacks |
| Progress | Strength, running and consistency analytics, personal records |
| Weekly review | Summary, recovery check-in, rule-based insights, conservative recommendations |
| Settings | Profile, units, time zone, language, theme, data export, account deletion |
| PWA | Installable, offline shell, cached media, offline logging with sync |

### Out of the MVP

AI recommendations; adaptive programmes; Garmin, Apple Health and Health Connect; GPS tracking; heart rate and sleep integrations; social features and leaderboards; coach accounts; multiple simultaneous programmes; subscriptions; nutrition.

**Extensibility hooks kept now:** `programmes` is generic data (not one hardcoded plan); `running_sessions.source` allows `manual | gps | import`; a `user_programmes` row per enrolment allows several programmes later; roles are not hardcoded into RLS policies.

## 4. Audit of the existing HTML prototype

The prototype (`programme_entrainement_dashboard_8_semaines.html`) is a single French-language page that is a reliable source for the programme content and coaching copy, and an unreliable source for images and data. Nothing in it is reused as code; its content is extracted into seed data.

### What it does

| Feature | How it works | Keep? |
| --- | --- | --- |
| Programme overview | Static header and three stat cards (3× strength per week, 9–11 km long run, 2–3 reps in reserve) | Content kept, as programme description |
| Weekly checklist | Week selector 1–8 with labels; one checkbox per day; progress bar out of 7; reset button | Replaced by schedule engine and real sessions |
| Daily plan | Seven day cards with exercises, sets × reps and an image each | Content kept as seed; images re-audited |
| Weekly log | One form per week: distance (km), duration (min), effort /10, weight (kg), notes | Split into running sessions, body measurements and weekly review |
| Progression and safety notes | Two text callouts | Copy kept, shown in programme and workout screens |
| Print | Browser print with print styles | Not in MVP |

### Data and storage defects

- All data lives in `localStorage` under `programme8w-<week>` and `log-<week>`: per browser, no account, lost on clearing storage.
- The checklist counts rest days as "activities completed" (x / 7), so adherence is inflated. v2 excludes rest days from adherence.
- One log per week, overwritten on every save: there is no history, and one run per week is the maximum.
- A ticked box is a completion with no detail: no sets, reps, duration or effort. This violates "never invent results" if migrated as completed sessions.
- **Migration decision:** prototype `localStorage` data is not imported automatically. An optional import may be offered later, mapping only explicit values (runs, weight) and never ticks into completed sessions.

### Image audit

The 12 files in `ressources_images/` were reviewed on 16 Nov 2026. Ten show the right exercise, but none can ship: they are thumbnails about 100 px wide (the spec is 1200 px), several have rounded card corners and white cut-out halos baked in, which suggests they were cropped from a rendered page, and their source and licence are unknown.

| File | Size | What it shows | Verdict |
| --- | --- | --- | --- |
| `traction.jpg` | 99 × 78 | Pull-up from behind, overhand on a bar | Correct for `pull-up` only; placeholder |
| `pompes.jpg` | 99 × 82 | Push-up, top position | Correct; placeholder |
| `pike-push-up.jpg` | 99 × 82 | Pike position, hips high, inverted V | Correct; placeholder |
| `squat-bulgare.jpg` | 99 × 87 | Split squat, rear foot on a bench | Correct; placeholder |
| `pont-fessier.jpg` | 99 × 82 | Glute bridge, hips raised | Correct; placeholder (not referenced by the prototype) |
| `pont-fessier-reference.jpg` | 600 × 600 | Glute bridge, studio photo | Actually a PNG; different style, branded footwear; not used (D19) |
| `pont-une-jambe.jpg` | 99 × 87 | Single-leg glute bridge, one leg extended | Correct; placeholder |
| `mollets.jpg` | 99 × 87 | Standing on a bench, heels not visibly raised | Does not show the movement; use the fallback |
| `planche.jpg` | 99 × 82 | Forearm plank | Correct; placeholder |
| `planche-laterale.jpg` | 95 × 87 | Straight-arm side plank, hand on hip, shirt graphic | Acceptable variation; placeholder |
| `releves-genoux.jpg` | 99 × 80 | Hanging from a bar, knees raised to about 90° | Correct; placeholder |
| `course.jpg` | 217 × 140 | Outdoor road run, landscape photo | Correct for `long-run` only, never for walking; placeholder |

Result: 10 development placeholders, and 9 library entries with no usable image (chin-up, squat, reverse lunge, crunch, calf raise, easy walk, three mobility drills). Production images are replaced by a commissioned illustration set (D18, section 8).

### Content to carry over

- Week labels: 1 Transition, 2–3 Installation, 4 Consolidation, 5 Deload, 6–7 Progression, 8 Evaluation.
- Tuesday: easy walk 15–30 min with no speed target; gentle mobility 5–10 min for hips, ankles and shoulders; full rest if tired.
- Monday note: legs stay light after the Sunday run. Saturday: no intense leg work, optional walk.
- Safety: keep 2–3 reps in reserve; do not add the old daily routines to this programme; reduce sets or rest if fatigue persists; stop a movement on sharp or worsening pain; the Sunday run is not a time trial.
- Equipment: pull-up bar; everything else bodyweight.

## 5. Core business rules

All rules below live in one pure TypeScript domain package (`packages/domain`), are unit-tested, and are never re-implemented in UI components or SQL views. Rule IDs (BR-x) are referenced by tests.

### 5.1 Schedule engine

The planned schedule is computed, never stored day by day. Inputs: the user's enrolment (`user_programmes.start_date`), the programme's weeks and days, schedule overrides, the user's time zone, and the sessions already logged.

- **BR-1 Week start.** Weeks run Monday 00:00 to Sunday 23:59:59 in the user's time zone (D5).
- **BR-2 Programme start.** Week 1 starts on the Monday on or after enrolment. The user may instead choose "start this week": days already past are marked *not scheduled* and excluded from adherence.
- **BR-3 Calendar date.** A programme day's date = week 1 Monday + (week − 1) × 7 + day offset (Monday 0 … Sunday 6), adjusted by any override.
- **BR-4 Time zone change.** Dates are recomputed in the new time zone; logged sessions keep their UTC timestamps and are never moved or relabelled.

### 5.2 Session status

| Status | Set by | Meaning |
| --- | --- | --- |
| Scheduled | Engine | Planned for today or a future date |
| In progress | User starts a session | Started, not yet saved |
| Partial | User saves before finishing | Saved with fewer sets than prescribed; data kept |
| Completed | User taps Finish and confirms | The only way a session becomes completed (BR-5) |
| Skipped | User, explicitly | Chosen not to do; never counted as missed |
| Missed | Engine, derived | Not completed, partial or skipped by 23:59:59 local on its scheduled day (D6) |
| Rest | Engine | Rest or recovery day; never missed |

- **BR-5 Explicit completion.** A session is completed only when the user completes it. A past date never completes a session.
- **BR-6 Partial save.** Leaving a workout, closing the app or losing connection keeps every logged set; the session resumes or is saved as partial.
- **BR-7 Missed is derived.** "Missed" is computed at read time, not written by a job, so a late log (for example, logging Monday's workout on Tuesday morning against Monday) turns it back to completed. Late logging is allowed for up to 7 days.
- **BR-8 Adherence.** Weekly adherence = (completed + 0.5 × partial) ÷ scheduled training sessions (strength and long run). Recovery and rest days are excluded; skipped sessions count as not done.

### 5.3 Rescheduling and recovery rules

A user can move a session to another date. The engine validates every move against the rules below and shows which rule blocks a date and why. Nothing is ever moved automatically.

- **BR-9 No back-to-back strength (D3).** No strength session on the calendar day after another strength session. Checked against both scheduled and logged sessions.
- **BR-10 Protect the long run (D4).** No lower-body session within 48 hours before the long run. Because sessions have dates but not times, this is enforced on calendar days: no lower-body session on the run day, the day before, or two days before (D, D−1, D−2). Strength B is tagged lower body.
- **BR-11 One session per day**. At most one strength session or long run per day; recovery activities do not count.
- **BR-12 Same week**. A session may only move within its Monday–Sunday week; otherwise the user skips it. A missed session is never carried into the next week.
- **BR-13 No valid date.** If no date in the week passes BR-9 to BR-12, the app recommends skipping and continuing the plan, never doubling up.

Worked examples on the standard week (Mon A, Tue recovery, Wed B lower, Thu rest, Fri C, Sat rest, Sun long run). These are acceptance tests for the engine.

| Missed | Candidate | Result | Rule |
| --- | --- | --- | --- |
| Mon A | Tue | Blocked: Wed B follows | BR-9 |
| Mon A | Thu | Blocked: Fri C follows | BR-9 |
| Mon A | Sat | Blocked: Fri C precedes | BR-9 |
| Mon A | — | No valid date; recommend skip | BR-13 |
| Wed B | Thu | Blocked: Fri C follows | BR-9 |
| Wed B | Sat | Blocked: day before long run, and Fri C precedes | BR-10, BR-9 |
| Fri C | Sat | Allowed: upper body, no strength on Thu or Sun | — |
| Sun run | Sat | Allowed if Thu and Fri hold no lower-body session | BR-10 |

### 5.4 Prescriptions and progression

- **BR-14 Single targets (D1).** Each prescription stores one target: reps, seconds or distance, equal to the upper bound of the original range. Strength targets are shown as "3 × 6"; a set counts as done whatever the reps achieved, because 2–3 reps in reserve are expected.
- **BR-15 Running targets are ceilings.** For the long run, the stored maximum is a ceiling: "up to 11 km at effort 5/10 or lower". The app never presents it as a distance to beat.
- **BR-16 Unilateral.** Per-side exercises store `per_side = true`; the target applies to each side and volume counts both sides.
- **BR-17 Deload (week 5).** Week 5 applies a volume multiplier of 0.65 (35% reduction): sets = max(1, round(sets × 0.65)), so 3 sets become 2 and 2 sets become 1; the long-run ceiling becomes 7 km (11 × 0.65, rounded down to a whole km). Reps per set are unchanged.
- **BR-18 No automatic progression.** A new week never raises reps, sets or distance on its own.
- **BR-19 Suggested progression**. At the end of a week, the app may suggest one change if adherence ≥ 75%, average RPE ≤ 7, fatigue ≤ 3/5 and no pain was reported: +1 rep on one exercise, or a long-run ceiling +10% at most. Never both in the same week. The user accepts or declines; accepted changes are stored as user overrides, and the programme template is never edited.

### 5.5 Running calculations

- **BR-20 Storage.** Distance in metres, duration in seconds, both integers.
- **BR-21 Validation.** Distance > 0 and duration > 0 are required; a pace outside 2:30–20:00 /km triggers a confirmation, not a block.
- **BR-22 Pace and speed.** Pace and speed are always computed from duration and distance, never typed in:

```latex
\text{pace}_{s/km} = \frac{\text{duration}_s}{\text{distance}_m / 1000} \qquad \text{speed}_{km/h} = \frac{\text{distance}_m / 1000}{\text{duration}_s / 3600}
```

- **BR-23 Formatting.** Pace is rounded to the nearest second and shown as m:ss /km (or /mi); speed to one decimal. Reference test: 10,840 m in 4,770 s → 440 s/km → 7:20 /km → 8.2 km/h (D2).

### 5.6 Data integrity and safety

- **BR-24 Unavailable, not zero.** A metric without data is shown as "—" with an explanation ("Log a run to see your pace"), never as 0.
- **BR-25 History is immutable.** Changing or leaving a programme never edits or deletes logged sessions, sets or runs; sessions keep a snapshot of the prescription they were logged against.
- **BR-26 Reference values are baselines.** The reference profile and onboarding measurements are stored as baseline measurements dated at onboarding. They are never shown as workout sessions or chart history before that date.
- **BR-27 Pain and discomfort.** Any reported pain switches the weekly recommendation to "reduce or rest", suppresses progression suggestions, and shows a non-diagnostic message advising professional advice if pain is sharp, persistent or worsening. The app never presents itself as medical advice.

## 6. Functional requirements

Each module lists what it must do and the acceptance criteria (AC) that close it. Every screen also meets the definition of done in section 13: loading, empty and error states, mobile and desktop, accessible, tested.

### 6.1 Authentication and account

- Email/password sign-up with email confirmation; login; logout; password reset by email; session refresh.
- Protected routes: every app route except landing, auth and legal pages requires a session.
- Settings: edit profile, units (metric/imperial), time zone, language (FR/EN), theme (light/dark/system).
- Data export (JSON and CSV of all user records) and account deletion (hard delete of all user rows and files, confirmed by typing a phrase).

**AC:** a new user can sign up, confirm, log in on a second device and see the same data; a deleted account cannot log in and leaves no rows in any user table.

### 6.2 Onboarding

Six short steps with progress shown; only step 1 fields marked required are mandatory, and every later step can be skipped and finished from Settings.

1. **Profile:** first name\*, birth year, height, units\*, time zone\* (detected, editable).
2. **Goals** (multi-select): build muscle, increase strength, improve endurance, improve running, general fitness, maintain.
3. **Experience:** beginner, intermediate, advanced.
4. **Equipment** (multi-select): bodyweight, pull-up bar, dumbbells, barbell, bands, gym, other.
5. **Availability:** training days, preferred duration, running day, rest days. For the launch programme these pre-fill from its schedule.
6. **Baselines** (optional): weight, max strict pull-ups, max push-ups, max controlled squats, reference run distance and time, effort.

The flow ends with a programme recommendation and "Start Monday" / "Start this week" (BR-2).

**AC:** a user who skips steps 2–6 reaches the dashboard; baselines are saved as dated measurements (BR-26); a programme requiring equipment the user lacks shows a warning.

### 6.3 Dashboard (Today)

Answers three questions in this order: what do I do today, how am I progressing, what is next.

- **Header:** greeting, programme name, "Week 3 of 8 · Installation", programme progress ring.
- **Today card:** session title, type, estimated duration, exercise list with targets, primary action (Start / Resume / Log run / View completed). Rest and recovery days show the day's recovery guidance instead.
- **Week strip:** Monday–Sunday with status per day (completed, partial, scheduled, missed, rest, today).
- **This week:** sessions done of scheduled, running distance, adherence %.
- **Recent activity:** last 5 sessions and runs.
- **Attention:** one card at most, e.g. "Wednesday was missed — see options" or "Weekly review is ready".

**AC:** the primary action is reachable with one thumb tap on a 360 px screen without scrolling; the dashboard loads in under 1.5 s (p75) on a mid-range phone on 4G; all metrics follow BR-24.

### 6.4 Programme and calendar

- Programme overview: description, 8-week timeline with week focus, safety notes.
- Week view with navigation across past and future weeks; each day shows session, status and targets after deload adjustments.
- Session detail: why this session exists (week focus and session purpose), exercises, targets.
- Reschedule: pick a date in the same week; blocked dates are disabled with the rule explained (BR-9 to BR-13); skip with an optional reason.
- Change history: moved and skipped sessions are labelled ("Moved from Mon").

**AC:** all worked examples in 5.3 pass in the UI; past weeks show only logged data, never prescriptions as results.

### 6.5 Workout execution

The most important flow; designed for one hand, sweaty fingers and glances between sets.

- Start a session from Today or the calendar; one exercise per screen with the list available in a drawer.
- Per exercise: name, image/video, 3 cue lines, target ("3 × 6", "2 × 45 s", "3 × 10 per leg"), set rows pre-filled with the target.
- Per set: one-tap "done as planned", or adjust reps/seconds, optional load (kg/lb) and reps in reserve.
- Rest timer starts automatically after a set (default from prescription), with skip, +15 s, vibration and sound at zero; keeps running if the screen locks.
- Timed holds (plank) have a built-in countdown.
- Skip an exercise, or substitute from compatible exercises (same category and available equipment).
- Pause and resume; elapsed time excludes paused time.
- Finish: summary of exercises, sets, total reps, duration, completion status, notes, RPE 1–10. Save as completed or partial.
- Autosave: every set is persisted locally as it is logged, and synced when online.

**AC:** killing the app mid-workout and reopening resumes at the same set with no data loss; a workout can be fully logged in airplane mode and syncs once without duplicates; tap targets are ≥ 48 px.

### 6.6 Running log

- Manual entry: date and start time, distance, duration (h:mm:ss), effort 1–10, optional route name, notes.
- Pace and speed computed live as the user types (BR-22).
- When a run is logged on or near a scheduled long-run day, the app asks whether it fulfils that session.
- Edit and delete own runs (delete asks for confirmation).

**AC:** entering 10.84 km and 1:19:30 shows 7:20 /km and 8.2 km/h; distance 0 is rejected with a clear message; a run linked to Sunday marks that day completed.

### 6.7 Exercise library

- Search by name and alternative names, in French and English; filter by muscle group, equipment, category, difficulty.
- Exercise detail: media, description, step-by-step instructions, common mistakes, variations, muscles, equipment, and personal history for that exercise.

**AC:** every exercise in the seed has media or the intentional fallback (section 8); search finds "traction" and "pull-up" for the same exercise.

### 6.8 Progress

- **Strength:** per exercise, best set (max reps or longest hold) over time, total sets and reps per week, personal records.
- **Running:** weekly and monthly distance, run count, longest run, best pace, pace over time, long-run progression.
- **Consistency:** weekly adherence, training streak (consecutive weeks ≥ 75% adherence), calendar heatmap, missed and skipped sessions.
- Range filter: 4 weeks, 8 weeks, programme, all time.
- Charts: line for performance over time, bars for weekly volume, ring for programme completion, heatmap for consistency; labelled axes, tooltips, units and empty states.
- Personal record rules: a PR is set only by a logged value strictly better than all earlier logged values; baselines count as the starting reference, labelled as such.

**AC:** a user with no data sees empty states with a call to action, not empty axes or zeros; charts never plot points before the first real log except the labelled baseline.

### 6.9 Weekly review

Offered from Sunday evening until the following Wednesday for each completed week.

- **Summary:** planned, completed, partial, missed and skipped sessions; strength and running sessions; total distance; longest run; average RPE; weight change if measured.
- **Check-in** on 1–5 scales: fatigue, soreness, sleep quality, motivation; pain yes/no with location and a note.
- **Insights** (rule-based, each with its rule shown on tap): frequency up/down, distance up more than 10%, two or more missed sessions, average RPE above 7, recovery low (fatigue or soreness ≥ 4, or sleep ≤ 2), volume stable.
- **Recommendation:** exactly one, from: maintain the workload; reduce sets next week; add a recovery day; keep running distance stable; do not increase strength and running together; accept a suggested progression (BR-19). Pain always leads to the cautious path (BR-27).

**AC:** a week with pain reported never shows a progression suggestion; insights reference only data the user logged.

## 7. Initial programme: seed specification

The launch programme is "Force, muscle & endurance — 8 weeks": three bodyweight strength sessions, one recovery day and one long run per week, for a pull-up bar and bodyweight. All targets below use the single-target rule (D1); rest times and durations *follow D12*.

### Reference profile (editable baselines, not history)

| Metric | Value | Stored as |
| --- | --- | --- |
| Age | 28 | Birth year |
| Height | 165 cm | `profiles.height_cm` |
| Weight | 55 kg | Baseline `body_measurements` row |
| Strict pull-ups (max) | 10 | Baseline test |
| Strict push-ups (max) | 20 | Baseline test |
| Controlled squats (max) | 40 | Baseline test |
| Reference run | 10.84 km in 1:19:30, effort 7/10 | Baseline run, flagged `is_baseline` |
| Computed pace | 7:20 /km | Derived, never stored as input |

The reference run is a demanding effort (7/10), not an easy-run benchmark; the long run targets 5/10 or lower.

### Weekly schedule

| Day | Session | Type | Counts for adherence |
| --- | --- | --- | --- |
| Monday | Strength A — Upper body | strength (upper) | Yes |
| Tuesday | Recovery and mobility | recovery | No |
| Wednesday | Strength B — Lower and full body | strength (lower) | Yes |
| Thursday | Rest or mobility | rest | No |
| Friday | Strength C — Upper body | strength (upper) | Yes |
| Saturday | Rest before the long run | rest | No |
| Sunday | Long run | run | Yes |

### Strength A — Monday (est. 40 min)

| Order | Exercise | Sets | Target | Rest |
| --- | --- | --- | --- | --- |
| 1 | Pull-up | 3 | 6 reps | 120 s |
| 2 | Push-up | 3 | 12 reps | 90 s |
| 3 | Pike push-up | 2 | 8 reps | 90 s |
| 4 | Glute bridge | 2 | 15 reps | 60 s |
| 5 | Plank | 2 | 45 s | 60 s |

Coach note: legs stay light after Sunday's run.

### Strength B — Wednesday (est. 45 min)

| Order | Exercise | Sets | Target | Rest |
| --- | --- | --- | --- | --- |
| 1 | Chin-up | 3 | 6 reps | 120 s |
| 2 | Bulgarian split squat | 3 | 10 reps per leg | 90 s |
| 3 | Single-leg glute bridge | 3 | 10 reps per leg | 60 s |
| 4 | Standing calf raise | 3 | 20 reps | 60 s |
| 5 | Hanging knee raise | 2 | 12 reps | 60 s |

### Strength C — Friday (est. 30 min)

| Order | Exercise | Sets | Target | Rest |
| --- | --- | --- | --- | --- |
| 1 | Pull-up | 2 | 6 reps | 120 s |
| 2 | Push-up | 2 | 12 reps | 90 s |
| 3 | Pike push-up | 2 | 8 reps | 90 s |
| 4 | Side plank | 2 | 30 s per side | 45 s |

### Recovery days

- **Tuesday:** easy walk up to 30 min with no speed target; gentle mobility up to 10 min (hips, ankles, shoulders); no intense circuit; full rest if tired.
- **Thursday:** rest, optional mobility.
- **Saturday:** rest; no intense leg work; optional walk.

### Sunday — Long run

Up to 11 km at a conversational pace, effort 5/10 or lower; walking intervals are fine; never a time trial. The app never raises the ceiling or pace on its own (BR-15, BR-18).

### Eight-week structure

| Week | Focus | Volume multiplier | Long-run ceiling |
| --- | --- | --- | --- |
| 1 | Transition and recovery | 1.0 | 11 km |
| 2 | Establish the routine | 1.0 | 11 km |
| 3 | Establish the routine and consistency | 1.0 | 11 km |
| 4 | Consolidation, controlled progression | 1.0 | 11 km |
| 5 | Deload | 0.65 | 7 km |
| 6 | Resume progression if recovery is good | 1.0 | 11 km |
| 7 | Progression, consolidate performance | 1.0 | 11 km |
| 8 | Evaluation and next programme | 1.0 | 11 km |

Week 5 sets after BR-17: Strength A 2-2-1-1-1, Strength B 2-2-2-2-1, Strength C 1-1-1-1. Week 8 offers optional re-tests of the baselines (max pull-ups, push-ups, squats), logged as tests and compared with week-0 baselines. Targets only rise through accepted suggestions (BR-19).

## 8. Exercise library and media

Every exercise has a stable slug, and its media is found only through that slug in a versioned manifest; no image is ever chosen by array position, filename guess or reuse from another exercise. The launch library has 19 entries: 14 from v1, plus walking, three mobility drills and the long run.

### Launch library

| Slug | English | French | Category | Used in | Development image | Production |
| --- | --- | --- | --- | --- | --- | --- |
| `pull-up` | Pull-up | Traction stricte | Upper · pull | A, C | `traction.jpg` | New illustration |
| `chin-up` | Chin-up | Chin-up (supination) | Upper · pull | B | Fallback (never `traction.jpg`) | New illustration, underhand grip visible |
| `push-up` | Push-up | Pompe | Upper · push | A, C | `pompes.jpg` | New illustration |
| `pike-push-up` | Pike push-up | Pike push-up | Upper · push | A, C | `pike-push-up.jpg` | New illustration |
| `bodyweight-squat` | Bodyweight squat | Squat au poids du corps | Lower | Substitute, baseline test | Fallback | New illustration |
| `bulgarian-split-squat` | Bulgarian split squat | Squat bulgare | Lower | B | `squat-bulgare.jpg` | New illustration |
| `reverse-lunge` | Reverse lunge | Fente arrière | Lower | Substitute | Fallback | New illustration |
| `glute-bridge` | Glute bridge | Pont fessier | Lower | A | `pont-fessier.jpg` | New illustration |
| `single-leg-glute-bridge` | Single-leg glute bridge | Pont fessier une jambe | Lower | B | `pont-une-jambe.jpg` | New illustration |
| `standing-calf-raise` | Standing calf raise | Extension des mollets debout | Lower | B | Fallback (`mollets.jpg` rejected) | New illustration, heels clearly raised |
| `plank` | Plank | Planche | Core | A | `planche.jpg` | New illustration |
| `side-plank` | Side plank | Planche latérale | Core | C | `planche-laterale.jpg` | New illustration, forearm version |
| `hanging-knee-raise` | Hanging knee raise | Relevé de genoux suspendu | Core | B | `releves-genoux.jpg` | New illustration |
| `abdominal-crunch` | Abdominal crunch | Crunch abdominal | Core | Substitute | Fallback | New illustration |
| `easy-walk` | Easy walk | Marche facile | Recovery | Tuesday | Fallback (never `course.jpg`) | New illustration |
| `mobility-hips` | Hip mobility | Mobilité des hanches | Mobility | Tuesday, Thursday | Fallback | New illustration |
| `mobility-ankles` | Ankle mobility | Mobilité des chevilles | Mobility | Tuesday, Thursday | Fallback | New illustration |
| `mobility-shoulders` | Shoulder mobility | Mobilité des épaules | Mobility | Tuesday, Thursday | Fallback | New illustration |
| `long-run` | Long run | Sortie longue | Running | Sunday | `course.jpg` | New illustration |

Each entry also needs: description, 3–6 instruction steps, 2–4 common mistakes, muscle groups, equipment, difficulty, variations and substitutes (by slug), in both languages.

### Media rules

- **Manifest:** `content/media/manifest.json` maps each slug to its file, width, height, alt text (EN and FR), licence, source, status (`placeholder` | `final` | `fallback`) and the reviewer who verified it.
- **Files:** `public/media/exercises/<slug>.webp`, 4:3, 1200 × 900 master with responsive sizes generated at build; optional `<slug>.mp4` loop under 2 MB.
- **Production set (D18):** 19 original illustrations plus 6 category fallbacks (upper, lower, core, recovery, mobility, running), commissioned as one set with full rights assigned. Flat vector style, one neutral figure with no identifiable face and no brand logos, same framing, line weight and background; the accent colour marks the working muscles. Delivered as SVG masters and exported to WebP. Briefed in Phase 0, delivered before the Phase 4 beta.
- **Development placeholders:** the 10 usable prototype images (section 4) are renamed to their slugs and marked `placeholder`. They may appear in local and preview builds only; `traction.jpg` maps to `pull-up` only and `course.jpg` to `long-run` only.
- **Fallback:** a missing, rejected or failed asset shows the category illustration labelled "Illustration coming soon", never another exercise's image.
- **Offline:** all exercise images in the user's current programme are pre-cached by the service worker.

### Media QA (automated, blocks CI)

1. Every exercise slug has exactly one manifest entry, or is listed as an intentional fallback.
2. Every file in the manifest exists, decodes, and matches its declared dimensions.
3. No file is referenced by two slugs.
4. The manifest key equals the file name stem.
5. Every entry has EN and FR alt text and a licence.
6. A Playwright test opens every exercise detail page and asserts the image loads and its alt text names that exercise.
7. A production build fails if any manifest entry has status `placeholder`.

A human visual review of each image against its exercise is required once per asset, and recorded in the manifest's `verified_by` field.

## 9. UX, design and localisation

GetFit should feel like a premium, calm athletic product: mobile first, one obvious action per screen, data that explains itself. It must not look like an admin dashboard, and it must not copy Strava, Strong, Hevy, Apple Fitness, Linear or Nike Training Club; those are references for specific qualities only.

### Navigation

| Mobile (bottom bar) | Desktop (sidebar) | Contains |
| --- | --- | --- |
| Home | Dashboard | Today, week strip, attention card |
| Programme | My Programme | Calendar, weeks, reschedule |
| Train (centre, primary) | Workouts | Start or resume today's session, log a run, history |
| Progress | Progress | Analytics, records, weekly reviews |
| Profile | Profile / Settings | Settings, library shortcut, export |

The exercise library is reachable from every exercise mention, from Train and from Profile on mobile, and from the sidebar on desktop.

### Visual system

- **Foundation:** near-black charcoal and white with light-grey secondary surfaces; light and dark themes from day one.
- **One brand accent**, cobalt (#2F5BEA light, #7B93FF dark), because green, amber and red are reserved for status (D16); contrast verified on both themes in Phase 1.
- **Semantic colours:** green = completed; amber = attention or recovery warning; red = errors and pain-related warnings only.
- **Type:** Inter or Geist; a tabular-numeral style for every metric; clear steps between page title, section heading, workout name, metric and supporting text.
- **Shape and motion:** 12–16 px radii, generous spacing on an 8 px grid, short transitions (150–250 ms), all disabled under reduced motion.
- **Components** (design system, built before pages): button, card, workout card, exercise card, nav bar, tabs, sheet/drawer, modal, input, number stepper, selector, date picker, progress ring, week strip, timer, chart wrappers, empty state, skeleton, toast.
- **Interaction states:** hover, focus, active, loading, success and error on every interactive element.

### Workout screen principles

- Readable at arm's length: target and current set in 32 px or larger; controls in the bottom half of the screen.
- Screen stays awake during a workout (Wake Lock API where available).
- No accidental exits: leaving asks to save as partial.

### Localisation

- French and English from launch; the language follows the browser, falls back to French, and can be changed in Settings (D15).
- All UI strings and all seeded content (exercise names, instructions, programme notes) are translated; no hardcoded strings in components.
- Numbers, dates and units are formatted per locale ("7:20 /km", "10,84 km" in French).
- The prototype's French coaching copy is the source for French content; English is translated from it and reviewed.

## 10. Technical architecture

GetFit is a modular monolith: one Next.js app on Vercel, one Supabase project, and a pure domain package that holds every business rule. The browser talks to Supabase only through the app's server layer for writes, and every query runs with the user's own session so Row Level Security always applies.

### Stack

| Layer | Choice | Note |
| --- | --- | --- |
| Framework | Next.js, App Router | Server Components for reads, Server Actions and route handlers for writes |
| Language | TypeScript, `strict` | No `any` in domain or services |
| UI | Tailwind CSS, shadcn/ui, Lucide | Design tokens as CSS variables |
| Forms and validation | React Hook Form + Zod | The same Zod schemas validate on client and server |
| Backend | Supabase: Postgres, Auth, Storage | Local Supabase in development |
| Charts | Recharts | Wrapped in design-system chart components |
| i18n | next-intl | FR and EN message catalogues |
| PWA | Web App Manifest + Serwist service worker | Offline shell and media cache |
| Offline store | IndexedDB via Dexie | Local outbox for workout and run writes |
| Monitoring | Sentry | Errors and performance |
| Product analytics | PostHog, EU region | No personal data in event properties |
| Testing | Vitest, Playwright | Unit and integration; end-to-end |
| Hosting | Vercel + Supabase | Preview deployment per pull request |

Versions are pinned to stable, mutually compatible releases chosen in Phase 1 and locked by the lockfile; upgrades are deliberate, not automatic.

### Layers

1. **UI** (`app/`, `components/`): presentation only; no business rules, no direct database calls.
2. **Services** (`server/services/`): one per area (profile, programme, schedule, workout, running, analytics, review); validate input with Zod, call the domain, read and write through repositories.
3. **Domain** (`packages/domain/`): pure functions with no I/O: schedule engine, statuses, recovery rules, deload, pace, units, volume, adherence, PRs, insights. Fully unit-tested.
4. **Data access** (`server/repositories/`): typed queries using generated Supabase types; the service-role key is used only by migrations, seeding and account deletion jobs, never in user requests.
5. **Offline** (`lib/offline/`): outbox, sync client, conflict handling (section 12).

### Repository structure

```
getfit/
  apps/web/
    app/                 routes: (auth), (app)/today, programme, train, progress, profile, library
    components/          design system (ui/) and feature components
    server/services/     business services
    server/repositories/ data access
    lib/offline/         outbox and sync
    messages/            fr.json, en.json
    public/media/        exercise media + manifest
  packages/domain/       pure TypeScript rules + tests
  supabase/
    migrations/          SQL migrations (schema, RLS, indexes)
    seed/                programme and exercise seed
  content/               programme and exercise source files (FR/EN)
  e2e/                   Playwright tests
  docs/                  architecture, decisions (ADRs), runbooks
  AGENTS.md, CLAUDE.md   shared agent conventions
```

Programme and exercise content lives as versioned source files in `content/` and is loaded into the database by the seed; it is never hardcoded in components.

### How the parts fit together

&#91;embedded content: system architecture · device, server, Supabase\]

The UI and the offline outbox write only through server services; services call the pure domain package for every rule and reach Postgres with the user's own session, so RLS applies to every query.

## 11. Data model

The schema separates shared content (programmes, exercises; read-only to users) from private user records (everything with a `user_id`; visible only to its owner). It fixes the v1 gaps: sessions and runs now link to the programme day they fulfil, sets record load, reps in reserve and substitutions, and prescriptions hold single targets with per-side and deload support.

### Content tables (seeded, read-only to users)

| Table | Key columns | Notes |
| --- | --- | --- |
| `exercises` | id, slug (unique), category, difficulty, equipment\[\], muscle\_groups\[\], is\_unilateral, media\_key, published | Never hard-deleted once referenced; unpublish instead |
| `exercise_translations` | exercise\_id, locale, name, alt\_names\[\], description, instructions (jsonb), common\_mistakes (jsonb), media\_alt | One row per locale (fr, en) |
| `exercise_relations` | exercise\_id, related\_exercise\_id, kind (variation \| substitute) | Drives substitutions |
| `programmes` | id, slug, version, duration\_weeks, difficulty, objectives\[\], required\_equipment\[\], published | New content = new version; enrolments keep theirs |
| `programme_translations` | programme\_id, locale, title, description, safety\_notes |  |
| `programme_weeks` | id, programme\_id, week\_number, focus\_key, volume\_multiplier, long\_run\_ceiling\_m | Week 5: 0.65 and 7,000 m |
| `session_templates` | id, programme\_id, slug, session\_type (strength \| run \| recovery \| rest), body\_focus (upper \| lower \| full \| none), estimated\_duration\_min, counts\_for\_adherence | Strength A, B, C, Long run, Recovery, Rest |
| `programme_days` | id, programme\_week\_id, day\_of\_week (1 = Monday … 7), session\_template\_id | 8 × 7 rows; templates are reused, not copied |
| `template_exercises` | id, session\_template\_id, exercise\_id, sequence, target\_sets, target\_reps, target\_duration\_s, target\_distance\_m, per\_side, rest\_s, note\_key | Check: exactly one target column is set |

### User tables (RLS: owner only)

| Table | Key columns | Notes |
| --- | --- | --- |
| `profiles` | id (= `auth.users.id`), first\_name, birth\_year, height\_cm, preferred\_units, locale, timezone, experience\_level, preferred\_duration\_min, onboarding\_completed\_at | No separate `users` table; no stored age or current weight |
| `user_goals` | id, user\_id, goal\_type, target\_value, target\_unit, target\_date, status |  |
| `user_equipment` | user\_id, equipment | Composite key |
| `user_availability` | user\_id, day\_of\_week, kind (training \| running \| rest) |  |
| `user_programmes` | id, user\_id, programme\_id, programme\_version, start\_date, start\_mode, status (active \| completed \| abandoned), ended\_at | One active enrolment per user (partial unique index) |
| `schedule_overrides` | id, user\_programme\_id, programme\_day\_id, original\_date, new\_date, action (moved \| skipped), reason | Unique per programme day |
| `prescription_overrides` | id, user\_programme\_id, template\_exercise\_id, from\_week, target\_reps / target\_duration\_s / target\_distance\_m, accepted\_at | Accepted progression suggestions (BR-19) |
| `workout_sessions` | id, user\_id, user\_programme\_id, programme\_day\_id, scheduled\_date, session\_template\_id, prescription\_snapshot (jsonb), status (in\_progress \| partial \| completed \| abandoned), started\_at, completed\_at, paused\_s, duration\_s, rpe, notes, client\_updated\_at, deleted\_at | Programme links are null for ad-hoc sessions |
| `workout_sets` | id, workout\_session\_id, exercise\_id, substituted\_for\_exercise\_id, set\_number, side (left \| right \| both), actual\_reps, actual\_duration\_s, load\_kg, rir, completed, logged\_at | Unique (session, exercise, set\_number, side) |
| `running_sessions` | id, user\_id, user\_programme\_id, programme\_day\_id, scheduled\_date, started\_at, local\_date, distance\_m, duration\_s, rpe, route\_name, notes, source (manual), is\_baseline, client\_updated\_at, deleted\_at | Checks: distance\_m > 0, duration\_s > 0; pace not stored |
| `body_measurements` | id, user\_id, measured\_at, weight\_kg, body\_fat\_pct, is\_baseline, notes | Single source of weight |
| `fitness_tests` | id, user\_id, tested\_at, test\_type (max\_pull\_ups \| max\_push\_ups \| max\_squats), value, is\_baseline | Baselines and week-8 re-tests |
| `weekly_reviews` | id, user\_id, user\_programme\_id, week\_start, fatigue, soreness, sleep\_quality, motivation (1–5), pain, pain\_location, pain\_notes, recommendation\_key, notes | Unique (user\_id, week\_start); week\_start is a Monday |

### Schema rules

- **IDs:** UUID primary keys everywhere. Records users create (sessions, sets, runs, measurements, reviews) get their ID on the device, so offline retries are idempotent.
- **Time:** `timestamptz` in UTC; `local_date` and `scheduled_date` are stored as dates computed from the user's time zone at write time.
- **Units:** metres, seconds, kilograms and centimetres in the database; conversion only at display.
- **One fulfilment:** a partial unique index allows only one partial or completed session (or run) per `user_programme_id` + `programme_day_id`.
- **History:** content tables referenced by history use `ON DELETE RESTRICT`; user tables cascade from `profiles`, so deleting the account deletes everything.
- **Soft delete:** user-deletable records carry `deleted_at` so deletions sync across devices; a nightly job purges rows deleted more than 30 days ago.
- **Indexes:** (user\_id, scheduled\_date), (user\_id, started\_at desc), (user\_id, local\_date), (user\_id, week\_start), plus every foreign key.
- **Migrations:** SQL files in `supabase/migrations`, reviewed like code; generated TypeScript types are committed and checked in CI.

## 12. Security, privacy, offline, accessibility and observability

Fitness and recovery data is personal data, and pain reports are close to health data, so GetFit collects only what it uses, isolates every user's rows at the database level, and lets users export or delete everything.

### Security and privacy

- **RLS on every user table**, enabled in the same migration that creates the table: `select/insert/update/delete` only where `user_id = auth.uid()` (or through the owning session for `workout_sets`). Content tables: `select` for authenticated users, no writes.
- **Isolation tests:** an automated test signs in as user A and asserts every user table returns nothing of user B, and that every write to B's rows fails.
- **Server-side validation** with Zod on every action and route; database check constraints as the last line.
- **Secrets** only in environment variables; the service-role key never reaches the browser or a user request path.
- **Rate limiting** on auth, sync and export endpoints.
- **Errors:** user-facing messages are generic; details go to monitoring with personal fields scrubbed. No personal data in client logs or analytics properties.
- **Rights:** JSON/CSV export and hard account deletion (section 6.1); privacy policy and terms published before beta.
- **Positioning:** no diagnostic language anywhere; pain triggers BR-27 messaging.
- **Hosting region:** EU region for Supabase and analytics (D17, given French-speaking users and GDPR).

### PWA and offline

- Installable on mobile and desktop: manifest, icons (192, 512, maskable), theme colours for both modes, install prompt in Profile.
- Service worker caches the app shell, the current programme, its exercise content and media.
- Offline, users can open today's session and the current week, view exercise instructions, log a full workout and log a run.
- **Outbox sync:** every write goes to IndexedDB first with its client-generated ID, then syncs in order when online (on reconnect, on app focus and every 60 s while online).
- **Conflicts:** writes are upserts by ID, so a retried write never duplicates. For the same record edited on two devices, the latest `client_updated_at` wins and the other version is kept in the sync log. Two different sessions fulfilling the same programme day: the first completed one wins, the second is kept as an unlinked session and the user is told.
- **Visible state:** a quiet indicator shows "Saved on this device" vs "Synced"; failed syncs surface after 3 attempts.

### Accessibility

Target WCAG 2.2 AA: full keyboard navigation; visible focus; labels on every control; screen-reader names for charts with a text summary or data table alternative; contrast ≥ 4.5:1 for text in both themes; reduced-motion support; touch targets ≥ 48 px on the workout screen (24 px minimum elsewhere); timer announcements through a live region; alt text on all exercise media. Tested with axe in CI plus a manual VoiceOver and TalkBack pass per phase.

### Observability and analytics

- **Events:** `account_created`, `onboarding_completed`, `programme_started`, `workout_started`, `workout_completed`, `workout_abandoned`, `running_session_logged`, `weekly_review_completed`, `programme_completed`, `progress_viewed`, `session_rescheduled`, `sync_conflict`. Properties carry IDs and counts only.
- **Monitoring alerts:** failed workout saves, auth errors, sync conflicts and failures, missing media (fallback shown), dashboard p75 load over 1.5 s.
- Events are added with each feature, not at the end.

## 13. Testing and definition of done

Tests are written with each feature and run on every pull request; a phase cannot close with a failing or skipped test.

| Level | Tool | Must cover |
| --- | --- | --- |
| Unit | Vitest | Schedule engine (BR-1 to BR-4), statuses and missed timing across time zones and DST, every row of the 5.3 worked examples, deload rounding, pace/speed/units (including the 10.84 km reference), adherence, PRs, insights and recommendations, pain override |
| Database | Vitest + local Supabase | RLS isolation for every user table, constraints, unique fulfilment index, cascade deletion |
| Integration | Vitest | Services: onboarding, enrolment, workout start→partial→complete, run logging and linking, reschedule validation, weekly review, export |
| End-to-end | Playwright (mobile and desktop viewports) | Register → onboarding → start programme → open today → log sets → save → dashboard updates → log run → progress shows it → log out and in → data still there; offline workout then sync without duplicates |
| Media | Vitest + Playwright | The six checks in section 8 |
| Accessibility | axe in Playwright | Every main screen in both themes |

Time-dependent tests use an injected clock; no test depends on the real date.

### Definition of done (per feature)

- [ ] Works on a 360 px phone and a 1440 px desktop, light and dark themes
- [ ] Loading, empty and error states designed and implemented
- [ ] Invalid input handled with clear messages; server-side validation in place
- [ ] Data persists and reloads correctly; RLS covers any new table
- [ ] Accessible: keyboard, labels, contrast, axe clean
- [ ] Unit/integration tests for its rules; E2E updated if it touches the core loop
- [ ] FR and EN strings complete
- [ ] Analytics events and error monitoring wired
- [ ] No regressions in the full test suite; reviewed in a preview deployment

## 14. Delivery plan

Delivery runs in five phases, each closed by exit criteria rather than dates. The first milestone is a thin slice through every layer: a logged-in user opens the app on a phone, sees Monday's Strength A, logs their sets, saves, and finds the data intact after logging out and back in.

### Phases

| Phase | Goal | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| 0 · Decisions | Remove ambiguity before code | Prototype audit (done, section 4); decisions D1–D8 (done); open questions resolved (done, D9–D19); `ressources_images/` reviewed (done, section 4); illustration set briefed and commissioned; `AGENTS.md` / `CLAUDE.md` written | All blocking open questions answered; media plan agreed |
| 1 · Foundation | A secure, tested base with the first milestone | Monorepo, CI (lint, types, tests), local Supabase; schema + migrations + RLS; email/password auth and protected routes; domain package with schedule engine, statuses, recovery rules, deload, pace and units; programme and exercise seed (FR/EN); design tokens and core components; media manifest + QA tests; first milestone slice | RLS isolation tests pass; all section 5 worked examples pass; first milestone works on a phone in a preview deployment |
| 2 · Core loop | Train the programme end to end | Onboarding; Today dashboard; programme calendar with reschedule and skip; exercise library; full workout execution (timer, substitute, pause, partial, finish, RPE); manual run log linked to Sunday; core E2E test | Core-loop E2E green on mobile and desktop; a full programme week can be logged |
| 3 · Insight | Make progress and recovery visible | Progress analytics and PRs; consistency heatmap and streaks; weekly review with check-in, insights and one recommendation; progression suggestions (BR-19); pain messaging; full dashboard | All BR-19 to BR-27 tests pass; empty states verified with a brand-new account |
| 4 · Production | Ship to real users | PWA install, offline shell, offline logging and outbox sync; monitoring and alerts; security review and rate limiting; export and deletion; accessibility audit; performance budget; privacy policy and terms; production deploy; beta with feedback collection | Offline E2E passes without duplicates; WCAG 2.2 AA audit has no open blockers; beta users onboarded |

Phase 2 design work starts with the mobile workout screen and is validated on a real phone before the other screens are built.

### Roadmap at a glance

&#91;embedded content: delivery roadmap · 5 phases, 5 gates\]

Phases end on exit criteria, not dates; the highlighted gate is the first milestone, a phone user completing Strength A with the data persisted.

## 15. Agent working agreement (Codex and Claude Code)

Both agents work from this PRD in one repository, under one set of conventions written in `AGENTS.md` (mirrored in `CLAUDE.md`) before any code is written.

- **Plan first.** Each phase starts with a written plan in `docs/plans/` (scope, files touched, tests to add, risks), reviewed before implementation.
- **Ownership per task, not per agent.** One task = one branch = one pull request = one agent; no two agents edit the same area at the same time.
- **Small, testable pull requests** with tests in the same PR; CI must be green; no PR mixes refactoring with features.
- **Rules in the domain package only.** Any new business rule gets a BR number in this PRD and a test before UI work uses it.
- **Schema changes only by migration**, with RLS in the same migration and regenerated types.
- **No mock data for authenticated users**, no invented history, no placeholder buttons or pages left in a merged PR.
- **Media:** never add or rename an image without updating the manifest and passing the media QA.
- **Decisions** that change architecture or a rule are recorded as an ADR in `docs/decisions/` and, if they change product behaviour, in this PRD's decision log.
- **Delivery package** at the end: source, migrations, seed, tests, PWA config, `.env.example` with every variable documented, local setup, deployment guide, architecture doc, README, and a list of implemented features and known limitations.

## 16. Open questions and risks

### Open questions

All open questions were resolved on 16 Nov 2026 and recorded as D9–D19 in the decision log; new questions are added here as they come up.

### Resolved questions

| Question | Decision |
| --- | --- |
| One session per day; moves within the week | Yes to both (D9, D10) |
| Deload numbers | Sets × 0.65, long run 7 km (D11) |
| Progression suggestion thresholds | Kept as written in BR-19 (D13) |
| Rest times and durations | As in section 7 (D12) |
| Late logging window | 7 days (D14) |
| Default language | Browser language, French fallback (D15) |
| Name and accent | GetFit, cobalt (D16) |
| Tooling | next-intl, Serwist, Dexie, Sentry, PostHog EU (D17) |
| Prototype images | Development placeholders only; commissioned set for production (D18, D19) |
| Phase 1 planning gaps (enrolment before onboarding, set persistence before the outbox, rescheduling scope, status timing, rest templates, long-run ceiling, fulfilment, media, categories, scope) | Resolved in `docs/plans/phase-1.md` (D20–D29) |
| Phase 2 planning gaps (run linking, pause, settings scope, availability, Today scope, changing a move or skip, timers, skip and substitute, load and RIR) | Resolved in `docs/plans/phase-2.md` (D33–D41) |

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Exercise illustrations take longer than code | Library and workout screens ship with fallbacks | Start sourcing in Phase 0; fallback built in Phase 1; media QA in CI |
| Offline sync creates duplicates or lost sets | Users lose trust in their history | Client IDs and upserts from Phase 1; outbox tested with network-loss E2E |
| Time-zone and DST bugs in missed status | Wrong "missed" labels and adherence | Injected clock; tests across zones and DST transitions |
| Recovery rules leave no valid date | Users feel blocked | BR-13 recommends skipping clearly, with the reason shown |
| Two agents diverge in architecture | Rework and inconsistent code | Shared conventions file, one task per PR, plan review per phase |
| RLS gap exposes another user's data | Severe privacy incident | RLS in every table's migration; isolation tests block CI |
| Scope creep from future features | MVP slips | Out-of-scope list in section 3; changes go through the decision log |
