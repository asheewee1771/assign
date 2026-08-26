/** Shown when .env has no Supabase credentials, so a fresh clone still runs. */
export function SetupNotice() {
  return (
    <section className="card setup">
      <h2>Not connected yet</h2>
      <p>
        This tracker stores its data in Supabase. Three steps to connect it:
      </p>
      <ol>
        <li>
          Create a free project at <code>supabase.com</code>.
        </li>
        <li>
          In the SQL Editor, run <code>supabase/schema.sql</code>, then
          <code> supabase/set-poc-password.sql</code> (edit the passphrase first).
        </li>
        <li>
          Copy <code>.env.example</code> to <code>.env</code> and fill in your
          project URL and anon key, then restart the dev server.
        </li>
      </ol>
      <p className="hint">Full details are in the README.</p>
    </section>
  )
}
