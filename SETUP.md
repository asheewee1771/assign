# Supabase setup, step by step

Everything here needs your Supabase login, so it can't be scripted. Budget about
10 minutes. Supabase renames things in the dashboard from time to time — where a
menu name doesn't match, the value you're hunting for is described in words too.

---

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) → **New project**.
2. Fill in:
   - **Name** — `assign` (only you see this).
   - **Database Password** — click Generate, then **save it in your password
     manager**. ⚠️ This is *not* the POC password. It's the Postgres superuser
     password, used for direct database connections. The app never uses it, and
     you cannot retrieve it later — only reset it.
   - **Region** — **Southeast Asia (Singapore)** is closest. Region can't be
     changed later without recreating the project.
   - **Plan** — Free is fine. See the free-tier note at the bottom.
3. Wait ~2 minutes while it provisions.

---

## 2. Create the tables, rules, and functions

1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy **the whole file**, paste it in.
3. Click **Run** (or Cmd+Enter).

You should see `Success. No rows returned`. This creates:

- tables `requests`, `reviewers`, `app_settings`
- the `CHECK` constraint enforcing 1st ≠ 2nd reviewer
- row level security denying all direct writes
- every function the app calls
- the realtime publication entries, so changes push to other people's screens

The script is safe to re-run — it uses `if not exists` and `create or replace`
throughout.

**Verify it worked.** New query, run this:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

Expect three rows: `app_settings`, `requests`, `reviewers`.

---

## 3. Set the POC password

This is the password that lets someone assign 2nd reviewers, mark requests
complete, remove any request, and manage the roster.

1. Open `supabase/set-poc-password.sql`.
2. **Replace `correct-horse-battery-staple`** with your real passphrase.

   Use **4 or more random words**. POC functions are callable from the public
   page, so a short password or a PIN can be guessed by repeated calls. Something
   like `stapler-mango-drift-lantern` is good; `assign2024` is not.

3. Paste into the SQL Editor and **Run**.

Only a bcrypt hash is stored — the plaintext is never saved.

**Verify it worked:**

```sql
select verify_poc('the-passphrase-you-chose');
```

Expect `true`. If you get `false`, the passphrase doesn't match what you set.

---

## 4. Add reviewers

Two options — either is fine:

- **In the app** (recommended): unlock the POC panel later and add them there.
- **Now, in SQL**: edit the names in `supabase/seed.sql` and run it.

Reviewers are deactivated rather than deleted when removed, so past assignments
keep showing the right name.

---

## 5. Get the two values the app needs

Left sidebar → **Project Settings** (gear icon).

**Project URL** — under **Data API** (older dashboards: **API**). Looks like:

```
https://abcdefghijklmnop.supabase.co
```

**The client key** — under **API Keys**. Supabase is mid-migration between two
key formats, so you may see either or both:

| What you see | Use it? |
| --- | --- |
| `anon` / `public` — a long JWT starting `eyJ...` | ✅ Yes |
| **Publishable key** — starts `sb_publishable_...` | ✅ Yes (preferred if offered) |
| `service_role` — JWT, marked secret | ❌ **Never** |
| **Secret key** — starts `sb_secret_...` | ❌ **Never** |

Take whichever of the first two you have. Both are designed to be public and
safe to ship inside the page; row level security is what protects your data.

> **The service_role and secret keys bypass row level security entirely.** They
> must never go in `.env`, in this repo, or in a GitHub variable. If one ever
> leaks, rotate it immediately in the dashboard.

---

## 6. Connect the app

In the project folder:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...    # or sb_publishable_...
```

Notes:

- **No quotes**, no trailing spaces, no trailing slash on the URL.
- The variable name stays `VITE_SUPABASE_ANON_KEY` even if you pasted a
  publishable key — it's just the name the code reads.
- Vite only exposes variables starting with `VITE_`.
- **Restart the dev server** after editing `.env`. Vite reads it at startup;
  hot reload will not pick up the change.

```bash
npm install
npm run dev
```

---

## 7. Check it actually works

Walk this once — it exercises every rule:

1. The page shows the tracker, not "Not connected yet". ✅ URL and key are good.
2. Type your name in **You are**, file a **V** request. ✅ Inserts work.
3. Unlock the **POC** panel with your passphrase. ✅ `verify_poc` works.
4. Add two reviewers in the POC panel. ✅ POC writes work.
5. Set your name to one of the reviewers, click **Volunteer** on the request.
6. As POC, open the 2nd-reviewer dropdown. **The 1st reviewer should not be in
   the list.** ✅ The same-person rule is live.
7. Open the app in a second browser window. Change something in one; the other
   updates within a second or two. ✅ Realtime is working.
8. Try to remove a request while using a different name than the one that filed
   it — it should refuse. ✅ Ownership convention holds.

**The security check worth doing once.** Row level security is what actually
protects the data, so prove it denies a direct write. In a terminal, with your
real URL and key, try to delete every request:

```bash
curl -i -X DELETE "https://YOUR-PROJECT.supabase.co/rest/v1/requests?id=neq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: YOUR-ANON-KEY" \
  -H "Authorization: Bearer YOUR-ANON-KEY"
```

Your requests must still be there afterwards. That is the real test: it bypasses
the app entirely and goes straight at the database with the same key any visitor
can read out of the page. If this ever deletes anything, the schema did not apply
correctly — re-run `schema.sql` and check **Authentication → Policies** shows
`requests` with only SELECT and INSERT policies, and no UPDATE or DELETE.

---

## 8. Deploy for the group

The live page needs the same two values at build time. They go in as
**variables**, not secrets — secrets are awkward to use at build time, and these
are public anyway.

GitHub → your repo → **Settings** → **Secrets and variables** → **Actions** →
**Variables** tab → **New repository variable**:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon / publishable key |

Then push any commit (or **Actions** → Deploy to GitHub Pages → **Run workflow**)
and the deploy picks them up. Until they're set, the deployed page shows the
setup instructions.

---

## Troubleshooting

| What you see | Cause | Fix |
| --- | --- | --- |
| "Not connected yet" after editing `.env` | Dev server not restarted, or names misspelled | Restart `npm run dev`; names must be exactly `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| "Could not reach Supabase" | Wrong URL, or project paused | Check the URL has no trailing slash; open the dashboard to wake a paused project |
| "Supabase did not respond" | Free-tier project waking up | Open the dashboard, wait ~30s, reload |
| `relation "requests" does not exist` | `schema.sql` wasn't run, or errored partway | Re-run the whole file; it's safe to repeat |
| `function verify_poc(text) does not exist` | Same as above | Re-run `schema.sql` |
| `Incorrect POC password` when you're sure it's right | `set-poc-password.sql` not run, or run before `schema.sql` | Run `schema.sql` first, then the password file |
| `permission denied for table requests` | Row level security is on but policies missing | Re-run `schema.sql` |
| Changes don't appear in other windows | Tables missing from the realtime publication | Re-run `schema.sql` (it adds them); check **Database → Publications** shows both tables |
| `new row violates check constraint "reviewers_differ"` | Working as designed | You tried to put the same person in both slots |

---

## Free tier, honestly

- **Projects pause after ~7 days with no activity.** The first load afterwards
  fails or is slow until you open the dashboard to wake it. For a team using
  this weekly it's a non-issue; for sporadic use, expect it.
- **500 MB database, 2 projects.** This app's data is tiny — thousands of
  requests would still be a few MB.
- **Nothing here needs a paid plan.**
