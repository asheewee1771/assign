-- assign — schema, row level security, and the complete mutation surface.
-- Run this once in the Supabase SQL Editor, then run supabase/set-poc-password.sql.
--
-- Design note: the anon key is public (it ships inside the deployed page), so RLS
-- denies every direct write. All mutations go through SECURITY DEFINER functions
-- below, and POC-only actions verify a password server-side.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table if not exists reviewers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  create type request_type as enum ('V','T');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('new','assigned','in_review','completed');
exception when duplicate_object then null; end $$;

create table if not exists requests (
  id                 uuid primary key default gen_random_uuid(),
  type               request_type not null,
  title              text not null check (length(btrim(title)) > 0),
  description        text not null default '',
  -- V/T-specific fields land here later, no migration needed.
  details            jsonb not null default '{}'::jsonb,
  created_by         text not null check (length(btrim(created_by)) > 0),
  status             request_status not null default 'new',
  first_reviewer_id  uuid references reviewers(id) on delete set null,
  second_reviewer_id uuid references reviewers(id) on delete set null,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  -- The load-bearing rule. Holds even against direct API calls and races.
  constraint reviewers_differ check (
    first_reviewer_id is null
    or second_reviewer_id is null
    or first_reviewer_id <> second_reviewer_id
  )
);

create index if not exists requests_status_idx  on requests (status);
create index if not exists requests_created_idx on requests (created_at desc);

create table if not exists app_settings (
  id                int primary key default 1,
  poc_password_hash text not null,
  constraint single_row check (id = 1)
);

-- ------------------------------------------------------------------ RLS
-- Read is open. Filing a request is open. Everything else is denied here and
-- only reachable through the functions further down.

alter table requests     enable row level security;
alter table reviewers    enable row level security;
alter table app_settings enable row level security;

drop policy if exists requests_read   on requests;
drop policy if exists requests_insert on requests;
drop policy if exists reviewers_read  on reviewers;

create policy requests_read   on requests  for select using (true);
create policy requests_insert on requests  for insert with check (true);
create policy reviewers_read  on reviewers for select using (true);

-- app_settings deliberately has NO policies, so the password hash is unreadable.

-- ------------------------------------------------------- password checking

create or replace function is_poc(p_password text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from app_settings
    where poc_password_hash = crypt(p_password, poc_password_hash)
  );
$$;

-- Lets the UI validate the password before showing the POC panel.
create or replace function verify_poc(p_password text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$ select is_poc(p_password); $$;

create or replace function require_poc(p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not is_poc(p_password) then
    raise exception 'Incorrect POC password' using errcode = '28000';
  end if;
end;
$$;

-- --------------------------------------------------- open (anyone) actions

-- Claim the empty 1st-reviewer slot.
create or replace function volunteer_first(p_request uuid, p_reviewer uuid)
returns requests
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare r requests;
begin
  -- Lock the row so two simultaneous volunteers cannot both succeed.
  select * into r from requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status = 'completed' then raise exception 'Request is already completed'; end if;
  if r.first_reviewer_id is not null then
    raise exception 'Someone already volunteered as 1st reviewer';
  end if;
  if not exists (select 1 from reviewers where id = p_reviewer and active) then
    raise exception 'Not an active reviewer';
  end if;
  if r.second_reviewer_id = p_reviewer then
    raise exception '1st and 2nd reviewer must be different people';
  end if;

  update requests set
    first_reviewer_id = p_reviewer,
    status = case when r.second_reviewer_id is not null then 'assigned'::request_status
                  else status end
  where id = p_request
  returning * into r;
  return r;
end;
$$;

-- Step back out of the 1st slot (only the person holding it).
create or replace function withdraw_first(p_request uuid, p_reviewer uuid)
returns requests
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare r requests;
begin
  select * into r from requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if r.first_reviewer_id is distinct from p_reviewer then
    raise exception 'You are not the 1st reviewer on this request';
  end if;
  if r.status = 'completed' then raise exception 'Request is already completed'; end if;

  update requests set first_reviewer_id = null, status = 'new'
  where id = p_request returning * into r;
  return r;
end;
$$;

create or replace function start_review(p_request uuid)
returns requests
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare r requests;
begin
  select * into r from requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'assigned' then
    raise exception 'Both reviewers must be assigned before review starts';
  end if;

  update requests set status = 'in_review' where id = p_request returning * into r;
  return r;
end;
$$;

-- Honour-system ownership: identity is a name the client claims, so this is a
-- convention for a trusted team, not a security boundary.
create or replace function remove_own_request(p_request uuid, p_name text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare removed int;
begin
  delete from requests
  where id = p_request and created_by = p_name;
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'Only the person who filed a request can remove it';
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------- POC actions

create or replace function poc_assign_reviewer(
  p_request uuid, p_slot text, p_reviewer uuid, p_password text
) returns requests
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare r requests;
begin
  perform require_poc(p_password);
  if p_slot not in ('first','second') then raise exception 'Slot must be first or second'; end if;

  select * into r from requests where id = p_request for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status = 'completed' then raise exception 'Request is already completed'; end if;

  if p_reviewer is not null
     and not exists (select 1 from reviewers where id = p_reviewer and active) then
    raise exception 'Not an active reviewer';
  end if;

  -- Checked here for a clear message; the CHECK constraint enforces it regardless.
  if p_slot = 'first'  and r.second_reviewer_id = p_reviewer then
    raise exception '1st and 2nd reviewer must be different people';
  end if;
  if p_slot = 'second' and r.first_reviewer_id = p_reviewer then
    raise exception '1st and 2nd reviewer must be different people';
  end if;

  update requests set
    first_reviewer_id  = case when p_slot = 'first'  then p_reviewer else first_reviewer_id  end,
    second_reviewer_id = case when p_slot = 'second' then p_reviewer else second_reviewer_id end
  where id = p_request returning * into r;

  update requests set status =
    case when r.first_reviewer_id is not null and r.second_reviewer_id is not null
         then 'assigned'::request_status else 'new'::request_status end
  where id = p_request and status in ('new','assigned')
  returning * into r;

  select * into r from requests where id = p_request;
  return r;
end;
$$;

create or replace function poc_complete_request(p_request uuid, p_password text)
returns requests
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare r requests;
begin
  perform require_poc(p_password);
  update requests set status = 'completed', completed_at = now()
  where id = p_request returning * into r;
  if not found then raise exception 'Request not found'; end if;
  return r;
end;
$$;

create or replace function poc_remove_request(p_request uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare removed int;
begin
  perform require_poc(p_password);
  delete from requests where id = p_request;
  get diagnostics removed = row_count;
  if removed = 0 then raise exception 'Request not found'; end if;
  return true;
end;
$$;

create or replace function poc_add_reviewer(p_name text, p_password text)
returns reviewers
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v reviewers;
begin
  perform require_poc(p_password);
  if length(btrim(coalesce(p_name,''))) = 0 then raise exception 'Name is required'; end if;

  insert into reviewers (name) values (btrim(p_name))
  on conflict (name) do update set active = true
  returning * into v;
  return v;
end;
$$;

-- Deactivate rather than delete, so historical assignments keep their names.
create or replace function poc_deactivate_reviewer(p_reviewer uuid, p_password text)
returns reviewers
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v reviewers;
begin
  perform require_poc(p_password);
  update reviewers set active = false where id = p_reviewer returning * into v;
  if not found then raise exception 'Reviewer not found'; end if;
  return v;
end;
$$;

-- ------------------------------------------------------------- realtime
-- Postgres Changes only delivers events for tables in this publication, and new
-- tables are NOT added automatically. Without this, the app's live updates
-- silently never fire and everyone has to refresh manually.

do $$
begin
  alter publication supabase_realtime add table requests;
exception
  when duplicate_object then null;   -- already added
  when undefined_object then null;   -- plain Postgres, no Supabase realtime
end $$;

do $$
begin
  alter publication supabase_realtime add table reviewers;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ------------------------------------------------------------- privileges
-- Only verify_poc is meant to be called from the browser. is_poc and require_poc
-- are internal helpers, so keep them off the public API surface.

revoke execute on function is_poc(text)      from public, anon, authenticated;
revoke execute on function require_poc(text) from public, anon, authenticated;

grant execute on function verify_poc(text)                              to anon, authenticated;
grant execute on function volunteer_first(uuid, uuid)                   to anon, authenticated;
grant execute on function withdraw_first(uuid, uuid)                    to anon, authenticated;
grant execute on function start_review(uuid)                            to anon, authenticated;
grant execute on function remove_own_request(uuid, text)                to anon, authenticated;
grant execute on function poc_assign_reviewer(uuid, text, uuid, text)   to anon, authenticated;
grant execute on function poc_complete_request(uuid, text)              to anon, authenticated;
grant execute on function poc_remove_request(uuid, text)                to anon, authenticated;
grant execute on function poc_add_reviewer(text, text)                  to anon, authenticated;
grant execute on function poc_deactivate_reviewer(uuid, text)           to anon, authenticated;
