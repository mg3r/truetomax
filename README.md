# Lodestar

A daily guide and creative partner. Each morning it hands you an affirmation, a passage you've saved from *The Creative Act*, a question to journal on, and what to do today — your weekly rhythm plus up to three suggestions from your partner. Underneath, it tracks visions, projects, goals and ideas, and learns from everything you write, finish, skip and eliminate.

Built with Next.js on Vercel, Supabase (Postgres + sign-in), and the Claude API. Installs to your phone's home screen as a PWA.

## What's in v1

| Screen | What it does |
| --- | --- |
| **Today** | Affirmation, today's passage, focus line, tasks (rhythm + carried over + yours), partner suggestions to accept or skip, the daily question with a journal box |
| **Journal** | Free writing plus every past entry |
| **Projects** | Projects with goals (+1 progress, targets, due dates), scheduled and "later" tasks, and keep / pause / finish / eliminate with a reason |
| **Visions** | What you're building toward, linked to the projects that serve it |
| **Ideas** | Partner surfaces feasible income ideas (with a money path and first step) or Instagram posts drawn from your week. Commit one to a project or eliminate it with a reason |
| **Partner** | Chat that knows your whole picture, plus a **focus review**: keep, pause or eliminate, using the evidence |
| **Setup** | About you, what the partner has learned (rewritten weekly), passages library, weekly rhythm |

**How it learns:** every partner call is built from your about-you text, visions, projects, goals, rhythm, the last two weeks of finished and skipped tasks, recent journal entries, open ideas, and everything you've eliminated and why. Once a week it rewrites a running summary of what it has learned about you, which feeds every later suggestion.

On first sign-in it seeds your weekly rhythm, four projects (pottery & art, DJing, cooking & hosting, sharing your work), and the goals you've already set — all editable.

## Setup (about 20 minutes)

### 1. Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of `supabase/migrations/0001_init.sql` → Run.
3. **Authentication → Email Templates → Magic Link**: add `{{ .Token }}` to the body, for example `Your Lodestar code: {{ .Token }}`. Typing the code (instead of tapping the link) is what keeps you signed in inside the installed phone app.
4. **Authentication → URL Configuration**: set Site URL to your Vercel URL, and add `https://YOUR-APP.vercel.app/auth/callback` to Redirect URLs.
5. After you've signed in once, turn off **Allow new users to sign up** (Authentication → Sign In / Providers). `ALLOWED_EMAIL` also blocks anyone else.

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
4. On Sunday, run a **focus review** in Partner.

## v2 roadmap
- **Instagram (truetomax):** sign in with Instagram (professional account, no Facebook Page needed) to pull posts, reach and engagement so the partner can see what lands and plan from it. Needs a Meta developer app with the `instagram_business_basic` and `instagram_business_manage_insights` permissions.
- **Google Calendar:** see today's events on Today, and schedule tasks into time blocks.
- **Google Drive:** attach docs to projects and visions; let the partner read them.
- Morning push notification with the day's affirmation.
