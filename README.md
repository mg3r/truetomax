# truetomax

A daily guide and creative partner. Each morning it hands you an affirmation, a passage you've saved from *The Creative Act*, a question to journal on, and what to do today — your weekly rhythm plus up to three suggestions from your partner. Underneath, it tracks visions, projects, goals and ideas, and learns from everything you write, finish, skip and eliminate.

Built with Next.js on Vercel, Supabase (Postgres + sign-in), and the Claude API. Installs to your phone's home screen as a PWA.

## What's in v1

| Screen | What it does |
| --- | --- |
| **Today** | Affirmation, today's passage, focus line, tasks (rhythm + carried over + yours), partner suggestions to accept or skip, **moves this week**, the daily question with a journal box |
| **Journal** | Free writing plus every past entry |
| **Projects** | Projects with goals (+1 progress, targets, due dates), scheduled and "later" tasks, and keep / pause / finish / eliminate with a reason |
| **Visions** | What you're building toward, linked to the projects that serve it |
| **Ideas** | Partner surfaces feasible income ideas (with a money path and first step) or Instagram posts drawn from your week. Commit one to a project or eliminate it with a reason |
| **Partner** | Chat that knows your whole picture, plus a **focus review**: keep, pause or eliminate, using the evidence |
| **Learned** | The weekly review, patterns it thinks it's found (confirm or reject), suggested rhythm changes (one tap to apply), results by week, and how it's guiding you now |
| **Setup** | About you, passages library, weekly rhythm |

## How it evolves with you

The model itself isn't retrained on your life — no app does that. truetomax evolves by keeping what it learns and changing what it does with it:

- **Moves.** The number that matters: times per week you share your work or ask someone to pay you (plus bookings, sales and money in). Finishing a partner task tagged *share* or *ask* logs one automatically; you can log any move from Today in two taps.
- **Results.** Every partner suggestion is tagged by kind of work (make, practice, share, ask…) and size. It tracks what you accept, finish and skip — by kind, size, weekday, and rhythm item.
- **Long-term memory.** Every journal entry, finished or skipped task, vision, elimination, move and substantial chat message is indexed. Each suggestion recalls the most relevant ones from any point in your history, not just the last two weeks.
- **Weekly learning pass.** Once a week (after you open Today), it reads everything and:
  - proposes specific patterns ("finishes cooking tasks, skips posting on studio days") with evidence and a confidence level — you confirm or reject them on **Learned**;
  - retunes how it suggests — how many tasks a day, what size, what to lean into, what to ease off;
  - proposes changes to your weekly rhythm based on what you actually do;
  - rewrites its read on you, and writes you a short weekly review.
- **Your answers steer it.** Confirmed patterns override its instincts. Rejected ones are never acted on again. You can also teach it something directly.

On first sign-in it seeds your weekly rhythm, four projects (pottery & art, DJing, cooking & hosting, sharing your work), and the goals you've already set — all editable.

## Setup (about 20 minutes)

### 1. Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste `supabase/migrations/0001_init.sql` → Run. Then do the same with `0002_learning.sql`, then `0003_book.sql`.
3. **Authentication → Sign In / Providers → Email**: turn **Confirm email** off, so creating your account doesn't depend on an email arriving. You sign in with email and password, typed inside the app, which keeps you signed in on the installed phone app.
4. **Authentication → URL Configuration**: set Site URL to your Vercel URL, and add `https://YOUR-APP.vercel.app/auth/callback` to Redirect URLs.
5. **Memory by meaning (recommended, free):** install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this folder run `supabase link` and `supabase functions deploy embed`. This uses Supabase's built-in embedding model, with no extra API key. Without it, memory search still works, by matching words instead of meaning.
6. After you've created your account, turn off **Allow new users to sign up** (Authentication → Sign In / Providers). `ALLOWED_EMAIL` also blocks anyone else.

### 2. Claude API
Create a key at [console.anthropic.com](https://console.anthropic.com). Daily use costs roughly a few dollars a month.

### 3. Vercel
1. Import this repo in Vercel.
2. Add the variables from `.env.example` under Project Settings → Environment Variables.
3. Deploy, then put the deployment URL into Supabase (step 1.4).

### 4. Install on your phone
- **iPhone:** open the site in Safari → Share → Add to Home Screen.
- **Android:** open in Chrome → menu → Install app.

### Run locally
```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev
```

## First week

1. In **Setup**, add 10–20 passages you've marked in *The Creative Act*.
2. Read the seeded **About you** and **Weekly rhythm**, and correct anything that's off.
3. Answer the daily question every day. The partner gets sharper with each entry; the weekly summary starts after three.
4. Log every move — every share, every ask — even small ones.
5. On Sunday, run a **focus review** in Partner. After your first full week, check **Learned** and confirm or reject what it found.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for every requirement and what comes next. In short:

### v2
- **Instagram (truetomax):** sign in with Instagram (professional account, no Facebook Page needed) to pull posts, reach and engagement so the partner can see what lands and plan from it. Needs a Meta developer app with the `instagram_business_basic` and `instagram_business_manage_insights` permissions.
- **Google Calendar:** see today's events on Today, and schedule tasks into time blocks.
- **Google Drive:** attach docs to projects and visions; let the partner read them.
- **Stripe and bank:** track money coming in from SourceDart and Intelligent Adjuster, read-only.
- Morning push notification with the day's affirmation.
