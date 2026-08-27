/**
 * Checks a real Supabase project against everything this app assumes.
 *
 *   node scripts/verify-supabase.mjs                 # read-only + security checks
 *   node scripts/verify-supabase.mjs "poc-password"  # adds the full rule walkthrough
 *
 * The rule checks create a request titled "[verify] ..." and remove it again.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const OFF = '\x1b[0m'

function fail(msg) {
  console.error(`\n${RED}${msg}${OFF}\n`)
  process.exit(1)
}

function loadEnv(path = '.env') {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    fail(`No ${path} file. Copy .env.example to .env and fill it in - see SETUP.md.`)
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

let failures = 0
const pass = (msg) => console.log(`  ${GREEN}PASS${OFF}  ${msg}`)
const bad = (msg, detail) => {
  failures++
  console.log(`  ${RED}FAIL${OFF}  ${msg}`)
  if (detail) console.log(`        ${detail}`)
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) fail('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must both be set in .env')
if (/YOUR-PROJECT|YOUR-ANON-KEY/.test(url + key)) {
  fail('.env still contains the placeholder values from .env.example')
}
if (key.startsWith('sb_secret_') || key.includes('service_role')) {
  fail('That looks like a SECRET key. Use the anon / publishable key - a secret key bypasses row level security.')
}

console.log(`\nProject: ${url}`)
console.log(`Key:     ${key.slice(0, 12)}...${key.slice(-4)} (${key.length} chars)\n`)

const db = createClient(url, key)
const pocPassword = process.argv[2] ?? null

// ------------------------------------------------------------------ schema
console.log('Schema')
for (const table of ['requests', 'reviewers']) {
  const { error } = await db.from(table).select('id').limit(1)
  if (error) bad(`table "${table}" readable`, error.message)
  else pass(`table "${table}" readable`)
}

// app_settings must NOT be readable - it holds the POC password hash.
{
  const { data, error } = await db.from('app_settings').select('*').limit(1)
  if (!error && data?.length) bad('app_settings is EXPOSED - the POC password hash is readable!')
  else pass('app_settings is not readable (password hash protected)')
}

// --------------------------------------------------------------- functions
console.log('\nFunctions')
{
  const { error } = await db.rpc('verify_poc', { p_password: 'definitely-not-the-password' })
  if (error && /does not exist/i.test(error.message)) {
    bad('verify_poc exists', 'Run supabase/schema.sql in the SQL Editor first.')
  } else if (error) {
    bad('verify_poc callable', error.message)
  } else {
    pass('verify_poc exists and is callable')
  }
}
{
  // Internal helper - should NOT be reachable from the browser.
  const { error } = await db.rpc('is_poc', { p_password: 'x' })
  if (error) pass('is_poc is not exposed to anon (as intended)')
  else bad('is_poc is callable by anon', 'Re-run schema.sql to apply the REVOKE.')
}

// ---------------------------------------------------------------- security
console.log('\nSecurity (row level security must block direct writes)')
{
  await db
    .from('requests')
    .update({ title: 'hacked-by-verify-script' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  const { data: after } = await db
    .from('requests')
    .select('title')
    .eq('title', 'hacked-by-verify-script')
  if (after?.length) bad('direct UPDATE blocked', 'Rows were modified! Re-run schema.sql.')
  else pass('direct UPDATE changed nothing')
}
{
  const { count: before } = await db.from('requests').select('*', { count: 'exact', head: true })
  await db.from('requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { count: after } = await db.from('requests').select('*', { count: 'exact', head: true })
  if (before !== after) {
    bad('direct DELETE blocked', `Row count went ${before} -> ${after}. Re-run schema.sql.`)
  } else {
    pass(`direct DELETE removed nothing (${after ?? 0} requests intact)`)
  }
}

// -------------------------------------------------- published-password check
// Any passphrase committed to this repo is readable by anyone. If one of them
// works on the live database, every reader of the repo is a POC.
const PUBLISHED_PLACEHOLDERS = [
  'REPLACE-THIS-BEFORE-RUNNING',
  'correct-horse-battery-staple',
  'changeme123',
]

console.log('\nPOC password')
{
  const live = []
  for (const candidate of PUBLISHED_PLACEHOLDERS) {
    const { data } = await db.rpc('verify_poc', { p_password: candidate })
    if (data === true) live.push(candidate)
  }
  if (live.length) {
    bad(
      'POC password is not a published placeholder',
      `"${live[0]}" is committed in this repo and WORKS. Anyone reading it can act as POC. Change it now.`,
    )
  } else {
    pass('POC password is not a published placeholder')
  }
}

// ------------------------------------------------------------------- rules
if (!pocPassword) {
  console.log('\nRules: skipped - pass the POC password to run them:')
  console.log('  npm run verify:supabase -- "your-passphrase"')
} else {
  console.log('\nRules')
  const ok = await db.rpc('verify_poc', { p_password: pocPassword })
  if (ok.data !== true) {
    bad('POC password accepted', 'verify_poc returned false. Did you run set-poc-password.sql?')
  } else {
    pass('POC password accepted')

    const { data: reviewers } = await db.from('reviewers').select('*').eq('active', true)
    if (!reviewers || reviewers.length < 2) {
      bad(
        'at least 2 active reviewers',
        `Found ${reviewers?.length ?? 0}. Add reviewers first (POC panel or seed.sql).`,
      )
    } else {
      const a = reviewers[0]
      const b = reviewers[1]
      const title = `[verify] delete me ${Date.now()}`

      const { error: insErr } = await db
        .from('requests')
        .insert({ type: 'V', title, description: '', created_by: 'verify-script' })

      if (insErr) {
        bad('anyone can file a request', insErr.message)
      } else {
        pass('anyone can file a request')
        const { data: rows } = await db.from('requests').select('*').eq('title', title)
        const req = rows?.[0]

        const v = await db.rpc('volunteer_first', { p_request: req.id, p_reviewer: a.id })
        if (v.error) bad('reviewer can volunteer as 1st', v.error.message)
        else pass(`reviewer can volunteer as 1st (${a.name})`)

        // The rule that matters most: one person cannot hold both slots.
        const clash = await db.rpc('poc_assign_reviewer', {
          p_request: req.id,
          p_slot: 'second',
          p_reviewer: a.id,
          p_password: pocPassword,
        })
        if (clash.error) pass('same person REJECTED for both slots')
        else bad('same person REJECTED for both slots', 'It was allowed! The CHECK constraint is missing.')

        const second = await db.rpc('poc_assign_reviewer', {
          p_request: req.id,
          p_slot: 'second',
          p_reviewer: b.id,
          p_password: pocPassword,
        })
        if (second.error) bad('POC can assign a different 2nd reviewer', second.error.message)
        else pass(`POC can assign a different 2nd reviewer (${b.name})`)

        const wrongPw = await db.rpc('poc_complete_request', {
          p_request: req.id,
          p_password: 'wrong-password',
        })
        if (wrongPw.error) pass('wrong POC password rejected')
        else bad('wrong POC password rejected', 'It was accepted!')

        const notMine = await db.rpc('remove_own_request', {
          p_request: req.id,
          p_name: 'someone-else',
        })
        if (notMine.error) pass("cannot remove someone else's request")
        else bad("cannot remove someone else's request", 'It was removed!')

        const mine = await db.rpc('remove_own_request', {
          p_request: req.id,
          p_name: 'verify-script',
        })
        if (mine.error) bad('requester can remove their own request', mine.error.message)
        else pass('requester can remove their own request (test data cleaned up)')
      }
    }
  }
}

// ---------------------------------------------------------------- realtime
console.log('\nRealtime')
await new Promise((resolve) => {
  const timer = setTimeout(() => {
    bad('realtime subscription connects', 'Timed out after 10s.')
    resolve()
  }, 10_000)
  const channel = db
    .channel('verify')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {})
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        pass('realtime subscription connects')
        void db.removeChannel(channel).then(resolve)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        bad('realtime subscription connects', `Status: ${status}`)
        resolve()
      }
    })
})

console.log(
  failures === 0
    ? `\n${GREEN}All checks passed.${OFF}\n`
    : `\n${RED}${failures} check(s) failed.${OFF} See SETUP.md troubleshooting.\n`,
)
process.exit(failures === 0 ? 0 : 1)
