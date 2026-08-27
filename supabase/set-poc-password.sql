-- Sets the POC password. Run ONCE, after schema.sql, in the Supabase SQL Editor.
--
-- ############################################################################
-- #  DO NOT COMMIT YOUR REAL PASSPHRASE.                                     #
-- #                                                                          #
-- #  This repository is public. Edit the value in the Supabase SQL Editor    #
-- #  (paste this file in, change the line, run it) and leave the copy on     #
-- #  disk with the placeholder. A passphrase committed here is a passphrase  #
-- #  anyone can read.                                                        #
-- ############################################################################
--
-- Use 4+ random words, 16 characters minimum. POC functions are callable from
-- the public page, so a short password can be guessed by repeated calls. Only a
-- bcrypt hash is stored; the plaintext is never saved.

do $$
declare
  -- >>> CHANGE THIS IN THE SQL EDITOR, NOT IN THE REPO <<<
  new_password text := 'REPLACE-THIS-BEFORE-RUNNING';
begin
  -- Known placeholders. Anything published in this repo must never be a live
  -- password, so refuse rather than quietly setting something guessable.
  if new_password in (
    'REPLACE-THIS-BEFORE-RUNNING',
    'correct-horse-battery-staple',
    'changeme123'
  ) then
    raise exception
      'That is a placeholder published in this repo. Choose your own passphrase (4+ random words) and do not commit it.';
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
