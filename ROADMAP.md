# truetomax roadmap

The full list of requirements, so nothing gets lost between sessions.

## Principle
Keep it simple: as few buttons and features as possible. Everything serves the purpose below.

## Purpose
An evolving guiding light: give each day direction, help execute visions, share gifts through aligned action, and find aligned work that makes money sustainably, with no return to a job. The core problems to solve are discipline, direction, and sharing work with the people who connect with it.

**Structure:** Vision is a living doc in your own words. Projects hold goals and tasks. Routine holds what you do daily, nightly and weekly. Schedule holds your weekly rhythm and calendar. Context holds your docs and the partner. Everything connects through the partner, not through links you maintain.

## Built
- [x] Daily affirmation, a random page from your copy of *The Creative Act*, a question from that page (swappable), journal
- [x] Today combines routine, Google Calendar events and project tasks
- [x] Routine: daily, nightly and weekly habits; tick them off on Today, weekly ones show on their day in Schedule, last-7-days dots, and the partner sees what holds and what slips (run `0009_routine.sql`)
- [x] Schedule: the whole week — weekly items, Google Calendar events and one-time tasks (from Today, Schedule or projects) in one ordered list; add Every week or Just once, with an optional project; edit in place
- [x] Vision: one running doc, new sections on top, drag to reorder, edit in place
- [x] Context: partner chat, your docs (upload PDF/Word/text or link Google Docs), book, settings
- [x] Projects: simple cards; inside, goals plus one place to add a task (Today / Up next / Later / Done), shown as a list or a board
- [x] Goals are plain text with a checkbox; project name, description, goals and tasks all edit in place
- [x] Partner chat, focus review, ideas (income and sharing), process of elimination
- [x] Learning: moves, suggestion results, long-term memory, weekly learning pass, insights you confirm or reject, rhythm proposals
- [x] PWA on Supabase + Vercel + Claude API; muted, minimal, organic theme
- [x] Google Calendar and Google Docs connection (code done; Google Cloud setup still to do)

- [x] Socials tab (Instagram first): account at a glance, every post with its numbers (Latest/Best), and the partner's read with recommendations (run `0012_socials.sql`); Ideas → Sharing uses it as context
- [x] Side navigation on computer (grouped: your day / building / reflecting and sharing, Profile at the bottom); phone keeps a bottom bar of four plus Menu
- [x] Profile → Docs: how everything works, with a section list to jump around

- [x] Tasks page: one running checklist of every task, Notes-style adding, move and project in place, import a list from a photo/PDF/doc with crossed-off items marked done
- [x] Today is for doing only (no add field); Up next has no day and is offered in the partner's suggestions
- [x] Partner suggests next steps inside each project
- [x] Today's reading is a whole section of the book, not a single page

- [x] Routine renamed Rituals; new Practices tab (what you make and offer, linked to the projects it feeds, sessions logged here or on Today) — run `0014_practices.sql`
- [x] The daily focus line comes only from what Max set or uploaded

- [x] Tasks renamed Actions (`/actions`); Today shows Calendar separately from Actions; Practices tab is information only, logged on Today, schedulable on Schedule

- [x] Docs searchable all the way through: every doc kept as passages and recalled by meaning (run `0015_doc_passages.sql`); Google Docs read every tab

## Next, in priority order
1. **Fill in your Vision, Projects, Routine and Schedule yourself** with what's alive today; every suggestion comes from this.
2. **Your setup steps still to confirm:** run migrations `0009` to `0015` in order if any haven't been run; check the 7am notification arrives.

## v2 integrations
5. **Instagram (truetomax):** code done (run `0006_instagram.sql`, Meta app setup, then Connect Instagram). Posts and their views, reach, saves and shares show under Ideas → Sharing; new posts count as moves; the partner plans from what lands.
6. **Stripe and bank:** read-only income from SourceDart and Intelligent Adjuster (Stripe restricted key; bank via an aggregator like Plaid). Income becomes a learned signal alongside moves.
7. **Google Drive folders:** code done (run `0007_drive.sql`). Paste a folder link under Context → Your docs; Google Docs, Word and text files inside (two levels deep) sync daily.
8. **Morning notification:** code done (run `0008_push.sql`; add `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Vercel; turn on in Context → Settings on your phone). Prepares the day at 7:30 local and sends the affirmation.
9. **Memory by meaning:** paste `supabase/functions/embed/index.ts` into Supabase → Edge Functions → Deploy a new function → Via Editor, named `embed`. Older memories catch up automatically.

## Later
- Productize as truetoyou: per-person onboarding replaces the seeded About you, routine and goals; the app name is already one setting (`NEXT_PUBLIC_APP_NAME`).
