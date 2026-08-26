-- Optional: seed a starting roster so the app is usable immediately.
-- The POC can add and remove reviewers in the app, so this is just a shortcut.
-- Replace these with real names.

insert into reviewers (name) values
  ('Reviewer One'),
  ('Reviewer Two'),
  ('Reviewer Three'),
  ('Reviewer Four'),
  ('Reviewer Five')
on conflict (name) do nothing;
