-- Sets the POC password. Run ONCE, after schema.sql, in the Supabase SQL Editor.
--
-- Change the value on the marked line before running. This script deliberately
-- REFUSES to run while it still says the example value, because that example is
-- committed in a public repository -- anyone reading it would know the password.
--
-- Use 4+ random words. POC functions are callable from the public page, so a
-- short password or a PIN can be guessed by repeated calls. Only a bcrypt hash
-- is stored; the plaintext is never saved.

do $$
declare
  -- >>> CHANGE THIS LINE <<<
  new_password text := 'correct-horse-battery-staple';
begin
  if new_password = 'correct-horse-battery-staple' then
    raise exception
      'Change the passphrase in this file before running it. The example value is published in the repo.';
  end if;

  if length(new_password) < 16 then
    raise exception
      'Passphrase is too short (% chars). Use 4+ random words -- POC functions are callable from the public page.',
      length(new_password);
  end if;

  insert into app_settings (id, poc_password_hash)
  values (1, extensions.crypt(new_password, extensions.gen_salt('bf', 12)))
  on conflict (id) do update
    set poc_password_hash = excluded.poc_password_hash;

  raise notice 'POC password set.';
end $$;

-- Confirm (should return true):
-- select verify_poc('the-passphrase-you-chose');
