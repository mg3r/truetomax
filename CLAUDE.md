# truetomax — working rules

- Keep the app very simple: as few buttons and features as possible; edit in place; easy delete.
- **Docs stay current.** Whenever a feature is added, changed or removed, update `src/components/HowItWorks.tsx` (Profile → Docs) in the same change, and `ROADMAP.md`.
- Migrations live in `supabase/migrations/` and are run by hand in the Supabase SQL Editor; the app degrades gracefully until they are.
- Integrations are read-only. Never put secrets in client code or `NEXT_PUBLIC_` variables.
