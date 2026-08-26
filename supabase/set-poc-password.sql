-- Run this ONCE, after schema.sql, in the Supabase SQL Editor.
--
-- Replace the passphrase below before running. Use 4+ random words, not a PIN:
-- POC functions can be called repeatedly from the public page, so a short
-- password is guessable. Nothing stores the plaintext — only a bcrypt hash.

insert into app_settings (id, poc_password_hash)
values (1, extensions.crypt('correct-horse-battery-staple', extensions.gen_salt('bf', 12)))
on conflict (id) do update
  set poc_password_hash = excluded.poc_password_hash;

-- Verify it worked (should return true):
-- select verify_poc('correct-horse-battery-staple');
