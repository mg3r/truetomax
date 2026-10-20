# truetomax roadmap

The full list of requirements, so nothing gets lost between sessions.

## Principle
Keep it simple: as few buttons and features as possible. Everything serves the purpose below.

## Purpose
An evolving guiding light: give each day direction, help execute visions, share gifts through aligned action, and find aligned work that makes money sustainably, with no return to a job. The core problems to solve are discipline, direction, and sharing work with the people who connect with it.

**Structure:** Vision is a living doc in your own words. Projects hold goals and tasks. Schedule holds your weekly rhythm and calendar. Context holds your docs and the partner. Everything connects through the partner, not through links you maintain.

## Built
- [x] Daily affirmation, a random page from your copy of *The Creative Act*, a question from that page (swappable), journal
- [x] Today combines routine, Google Calendar events and project tasks
- [x] Schedule: weekly rhythm by morning / afternoon / evening (time optional), plus the week's calendar
- [x] Vision: one running doc, new sections on top, drag to reorder, edit in place
- [x] Context: partner chat, your docs (upload PDF/Word/text or link Google Docs), book, settings
- [x] Projects: simple cards; inside, goals plus one place to add a task (Today / Up next / Later / Done), shown as a list or a board
- [x] Goals are plain text with a checkbox; project name, description, goals and tasks all edit in place
- [x] Partner chat, focus review, ideas (income and sharing), process of elimination
- [x] Learning: moves, suggestion results, long-term memory, weekly learning pass, insights you confirm or reject, rhythm proposals
- [x] PWA on Supabase + Vercel + Claude API; muted, minimal, organic theme
- [x] Google Calendar and Google Docs connection (code done; Google Cloud setup still to do)

## Next, in priority order
1. **Fill in your Vision, Projects and Schedule yourself,** with what's alive today. Most important, because every suggestion the partner makes comes from this.
2. **Partner suggests tasks for a project:** proposes 3–5 next steps from your vision, docs and history; you accept them into the project.
3. **Your setup steps:** run `0005_docs_schedule.sql`; Context → Settings → Start fresh; Google Cloud setup (enable the Calendar and Docs APIs), then Connect Google.

## v2 integrations
5. **Instagram (truetomax):** code done (run `0006_instagram.sql`, Meta app setup, then Connect Instagram). Posts and their views, reach, saves and shares show under Ideas → Sharing; new posts count as moves; the partner plans from what lands.
6. **Stripe and bank:** read-only income from SourceDart and Intelligent Adjuster (Stripe restricted key; bank via an aggregator like Plaid). Income becomes a learned signal alongside moves.
7. **Google Drive folders:** code done (run `0007_drive.sql`). Paste a folder link under Context → Your docs; Google Docs, Word and text files inside (two levels deep) sync daily.
8. **Morning notification:** code done (run `0008_push.sql`; add `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Vercel; turn on in Context → Settings on your phone). Prepares the day at 7:30 local and sends the affirmation.
9. **Memory by meaning:** paste `supabase/functions/embed/index.ts` into Supabase → Edge Functions → Deploy a new function → Via Editor, named `embed`. Older memories catch up automatically.

## Later
- Productize as truetoyou: per-person onboarding replaces the seeded About you, routine and goals; the app name is already one setting (`NEXT_PUBLIC_APP_NAME`).
