# assign

A request tracker with two-reviewer assignment, for a small team.

Anyone can file a request (**V** or **T**). Each needs a **1st reviewer** and a
**2nd reviewer**, and they must be two different people. Reviewers volunteer for
the 1st slot; the POC assigns the 2nd, marks requests completed, and manages the
roster.

## The rules

| Rule | Who | Enforced by |
| --- | --- | --- |
| File a request | Anyone | — |
| Volunteer as 1st reviewer | Any active reviewer | `volunteer_first` |
| Assign the 2nd reviewer | POC only | `poc_assign_reviewer` + password |
| 1st and 2nd must differ | — | **Database `CHECK` constraint** |
| Remove your own request | The person who filed it | `remove_own_request` (honour system) |
| Remove any request, mark completed | POC only | password-verified functions |
| Add/remove reviewers | POC only | password-verified functions |

The 1st ≠ 2nd rule lives in a `CHECK` constraint, so it holds even if the UI has
a bug, two people volunteer simultaneously, or someone calls the API directly.

## Setup

The app needs a Supabase project — that part needs your login, so it can't be
scripted for you.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier;
   Singapore is the closest region).
2. **Run the schema.** SQL Editor → paste `supabase/schema.sql` → Run.
3. **Set the POC password.** Edit the passphrase in
   `supabase/set-poc-password.sql`, then run it. Use 4+ random words — POC
   functions are callable from the public page, so a short password is guessable.
   Only a bcrypt hash is stored.
4. *(Optional)* **Seed a roster** with `supabase/seed.sql`, or just add reviewers
   in the app once you unlock the POC panel.
5. **Connect the app.** Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL` — Project Settings → Data API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Project Settings → API Keys → `anon` / public

   Both are safe to expose. **Never** put the `service_role` key here.

Then `npm install && npm run dev`. Without `.env` the app runs and shows these
steps instead of failing.

## Security model, and what it doesn't cover

The anon key ships inside the deployed page, so a password checked in JavaScript
would be a speed bump, not a control. Instead:

- **Row level security denies every direct write.** Anon can read requests and
  reviewers, and insert a request. No direct `UPDATE` or `DELETE` on anything.
  `app_settings` has no policies at all, so the password hash is unreadable.
- **All mutations go through `SECURITY DEFINER` functions.** POC functions verify
  the password server-side against a bcrypt hash.

Two honest limits:

- **"Only the requester can remove it" is a convention, not a control.** Identity
  is honour-system — you type your name, nothing verifies it, so anyone could
  claim to be anyone. Fine for a trusted team of eight; it is not a security
  boundary. Real enforcement needs real logins.
- **The POC password can be attacked by repeated calls.** Hence the long
  passphrase. If it matters more later, add an attempt log and throttle.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Rule tests (pure, no network) |
| `npm run build` | Type-check then bundle to `dist/` |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the built output |

## Deployment

Pushing to `main` builds and deploys to GitHub Pages. The workflow reads the
Supabase values from repo **variables** (Settings → Secrets and variables →
Actions → Variables), not secrets, since they're public by design:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Until those are set, the deployed page shows the setup instructions.

## Layout

```
src/
  lib/
    types.ts       shared types
    rules.ts       the rules as pure functions — tested
    rules.test.ts
    supabase.ts    client, with a request timeout
    api.ts         every write, one function per database RPC
  hooks/
    useTracker.ts  load + realtime subscription
  components/      WhoAmI, NewRequestForm, RequestCard, PocPanel, SetupNotice
  App.tsx
supabase/
  schema.sql            tables, RLS, and all functions
  set-poc-password.sql  run once, after editing the passphrase
  seed.sql              optional starting roster
```

`rules.ts` is where the logic worth testing lives; it has no I/O, so the tests
need no database. The database enforces the same constraints independently — the
UI is for feedback, the database is for truth.

## Adding V/T-specific fields

`requests.details` is a JSONB column, so type-specific fields can be added
without a migration: write them into `details` when filing, and read them back
per type in `RequestCard`.
