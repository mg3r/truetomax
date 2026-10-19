# truetomax roadmap

The full list of requirements, so nothing gets lost between sessions.

## Purpose
An evolving guiding light: give each day direction, help execute visions, share gifts through aligned action, and find aligned work that makes money sustainably, with no return to a job. The core problems to solve are discipline, direction, and sharing work with the people who connect with it.

**Structure:** practices (aligned actions: pottery, art, DJing, cooking, hosting) feed projects (a cacao brand, a dinner-gathering concept), and projects serve visions.

## Built
- [x] Daily affirmation, a random page from your copy of *The Creative Act*, a question from that page (swappable), journal
- [x] Today combines routine, Google Calendar events and project tasks
- [x] Routine tab with times, days and practices
- [x] Plan tab: practices → projects → visions; project board (Later / Up next / Today / Done)
- [x] Partner chat, focus review, ideas (income and sharing), process of elimination
- [x] Learning: moves, suggestion results, long-term memory, weekly learning pass, insights you confirm or reject, rhythm proposals
- [x] PWA on Supabase + Vercel + Claude API; muted, minimal, organic theme
- [x] Google Calendar connection (code done; Google Cloud setup still to do)

## Next, in priority order
1. **Fill in the plan, step by step:** visions first, then projects, then the routine. Most important, because every suggestion the partner makes comes from this.
2. **Partner suggests tasks for a vision or project:** a "Suggest next steps" button on each project and vision, which proposes 3–5 tasks to accept into a lane; it also runs when you create a project.
3. **Simplify projects:** replace the +1/−1 goal counters. A goal becomes a plain outcome you tick off when it's true ("First paid dinner hosted"), with a number only if you choose to track one, typed directly.
4. **Your setup steps:** clear the starter projects (Setup → Start your plan fresh), and the Google Cloud setup for Calendar.

## v2 integrations
5. **Instagram (truetomax):** professional account since Oct 19, 2026. Read posts, reach and engagement so the partner learns which posts land. Needs a Meta developer app (`instagram_business_basic`, `instagram_business_manage_insights`).
6. **Stripe and bank:** read-only income from SourceDart and Intelligent Adjuster (Stripe restricted key; bank via an aggregator like Plaid). Income becomes a learned signal alongside moves.
7. **Google Drive:** attach docs to projects and visions; the partner can read them.
8. **Morning notification** with the day's affirmation.
9. **Memory by meaning:** deploy the `embed` function (one command); search falls back to words until then.

## Later
- Productize as truetoyou: per-person onboarding replaces the seeded About you, routine and goals; the app name is already one setting (`NEXT_PUBLIC_APP_NAME`).
