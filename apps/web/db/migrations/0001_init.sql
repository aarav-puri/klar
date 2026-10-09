-- ===========================================================================
-- Klar schema (Neon Postgres, with Neon Auth for sign-in). Every
-- student-owned table carries user_id (the Neon Auth user id) and is
-- protected by row-level security: the server runs each student's queries
-- as the restricted role "klar_student" with klar.user_id set, so a bug in
-- application code still can't read another student's rows. Natural keys
-- make synchronization idempotent.
-- ===========================================================================

-- Restricted role used for per-student queries.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'klar_student') then
    create role klar_student nologin;
  end if;
end $$;
-- The app's own role must be able to SET ROLE klar_student (needed on Neon,
-- where the app connects as the database owner rather than a superuser).
grant klar_student to current_user;

-- Sign-in is Neon Auth (users and sessions live in the neon_auth schema).
-- Klar keys every row by that user id and reads it for RLS from klar.user_id,
-- which the server sets per transaction after verifying the session.
create schema if not exists klar;

create function klar.current_user_id() returns text language sql stable as
  $$ select nullif(current_setting('klar.user_id', true), '') $$;

-- Private schema: not exposed through the Data API. Holds OAuth tokens.
create schema if not exists private;
revoke all on schema private from klar_student;

-- ---------------------------------------------------------------------------
-- Users and settings
-- ---------------------------------------------------------------------------
create table public.profiles (
  id text primary key,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id text primary key,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  browser_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id text primary key,
  grade_posted boolean not null default true,
  grade_changed boolean not null default true,
  course_shift boolean not null default true,
  course_shift_threshold numeric(4, 1) not null default 2.0 check (course_shift_threshold between 0.5 and 20),
  new_assignment boolean not null default false,
  due_soon boolean not null default true,
  due_soon_hours integer not null default 48 check (due_soon_hours between 6 and 168),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Schools and connections
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  schoology_host text not null unique check (schoology_host ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  display_name text,
  -- Learned over time: whether the official API has worked for this host.
  api_supported boolean,
  created_at timestamptz not null default now()
);

create table public.schoology_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  school_id uuid not null references public.schools (id),
  method text not null check (method in ('extension', 'api')),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  account_label text check (char_length(account_label) <= 120),
  schoology_user_id text,
  consent_at timestamptz not null,
  last_sync_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Encrypted (AES-256-GCM, app-held key) OAuth access tokens for the official API.
create table private.schoology_tokens (
  connection_id uuid primary key references public.schoology_connections (id) on delete cascade,
  user_id text not null,
  token_ciphertext text not null,
  secret_ciphertext text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Academic data
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_id text not null,
  name text not null,
  teacher text,
  section_name text,
  reported_percent numeric(7, 3),
  reported_letter text,
  current_percent numeric(7, 3),
  grading_method text not null default 'total_points' check (grading_method in ('total_points', 'weighted_categories')),
  method_source text not null default 'assumed' check (method_source in ('schoology', 'inferred', 'assumed')),
  rounding_decimals smallint default 2,
  archived boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, source_id)
);

create table public.grading_periods (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  source_id text not null,
  title text not null,
  unique (course_id, source_id)
);

create table public.grading_categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  source_id text not null,
  name text not null,
  weight numeric(6, 2),
  unique (course_id, source_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  source_id text not null,
  category_source_id text,
  period_source_id text,
  title text not null,
  due_at timestamptz,
  possible numeric(9, 2),
  status text not null check (status in ('graded', 'missing', 'excused', 'incomplete', 'ungraded')),
  late boolean not null default false,
  extra_credit boolean not null default false,
  url text check (url is null or url like 'https://%'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Set when an item disappears from Schoology; kept so history stays explainable.
  removed_at timestamptz,
  unique (course_id, source_id)
);

create table public.grades (
  assignment_id uuid primary key references public.assignments (id) on delete cascade,
  user_id text not null,
  earned numeric(9, 2),
  possible numeric(9, 2),
  comment text check (char_length(comment) <= 2000),
  -- When the score was posted: the source's timestamp if it has one, otherwise
  -- the sync that first saw it appear or change. Null for scores that already
  -- existed when Klar started tracking the course (posting time unknown).
  graded_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source text not null check (source in ('extension_page', 'schoology_api')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('success', 'error')),
  courses_count integer not null default 0,
  assignments_count integer not null default 0,
  changes_count integer not null default 0,
  error_code text
);

create table public.grade_snapshots (
  id bigint generated always as identity primary key,
  user_id text not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  sync_run_id uuid references public.sync_runs (id) on delete set null,
  captured_at timestamptz not null,
  percent numeric(7, 3),
  letter text,
  unique (course_id, captured_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null check (kind in ('grade_posted', 'grade_changed', 'course_shift', 'new_assignment', 'due_soon')),
  dedupe_key text not null,
  title text not null,
  body text not null,
  course_id uuid references public.courses (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Replaying the same change can never create a second notification.
  unique (user_id, dedupe_key)
);

create index on public.assignments (user_id, due_at);
create index on public.grade_snapshots (user_id, captured_at desc);
create index on public.notifications (user_id, created_at desc);
create index on public.sync_runs (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings', 'notification_preferences', 'schoology_connections', 'courses',
    'grading_periods', 'grading_categories', 'assignments', 'grades', 'sync_runs',
    'grade_snapshots', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to klar_student using (user_id = (select klar.current_user_id()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to klar_student with check (user_id = (select klar.current_user_id()))', t);
    execute format('create policy "own rows: update" on public.%I for update to klar_student using (user_id = (select klar.current_user_id())) with check (user_id = (select klar.current_user_id()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to klar_student using (user_id = (select klar.current_user_id()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "own profile: select" on public.profiles for select to klar_student using (id = (select klar.current_user_id()));
create policy "own profile: update" on public.profiles for update to klar_student using (id = (select klar.current_user_id()));
create policy "own profile: insert" on public.profiles for insert to klar_student with check (id = (select klar.current_user_id()));
create policy "own profile: delete" on public.profiles for delete to klar_student using (id = (select klar.current_user_id()));

-- Schools hold no personal data; any signed-in student may read and register a host.
alter table public.schools enable row level security;
create policy "schools: read" on public.schools for select to klar_student using (true);
create policy "schools: register" on public.schools for insert to klar_student with check (true);

-- Children must belong to a course the student owns.
create policy "categories belong to own course" on public.grading_categories as restrictive for insert to klar_student
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select klar.current_user_id())));
create policy "periods belong to own course" on public.grading_periods as restrictive for insert to klar_student
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select klar.current_user_id())));
create policy "assignments belong to own course" on public.assignments as restrictive for insert to klar_student
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select klar.current_user_id())));
create policy "grades belong to own assignment" on public.grades as restrictive for insert to klar_student
  with check (exists (select 1 from public.assignments a where a.id = assignment_id and a.user_id = (select klar.current_user_id())));

-- ---------------------------------------------------------------------------
-- Data deletion: removes every synced record but keeps the login.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_grade_data() returns void
language sql security invoker set search_path = '' as $$
  delete from public.notifications where user_id = (select klar.current_user_id());
  delete from public.grade_snapshots where user_id = (select klar.current_user_id());
  delete from public.sync_runs where user_id = (select klar.current_user_id());
  delete from public.courses where user_id = (select klar.current_user_id());
  delete from public.schoology_connections where user_id = (select klar.current_user_id());
$$;

-- Everything Klar stores for the student, used when they delete their account
-- (the Neon Auth user itself is deleted through Neon Auth).
create or replace function public.delete_my_account_data() returns void
language sql security invoker set search_path = '' as $$
  select public.delete_my_grade_data();
  delete from public.notification_preferences where user_id = (select klar.current_user_id());
  delete from public.user_settings where user_id = (select klar.current_user_id());
  delete from public.profiles where id = (select klar.current_user_id());
$$;

-- ---------------------------------------------------------------------------
-- Privileges for the per-student role. RLS above restricts which rows.
-- ---------------------------------------------------------------------------
grant usage on schema public to klar_student;
grant usage on schema klar to klar_student;
grant execute on function klar.current_user_id() to klar_student;
grant select, insert, update, delete on all tables in schema public to klar_student;
grant usage, select on all sequences in schema public to klar_student;
grant execute on function public.delete_my_grade_data() to klar_student;
grant execute on function public.delete_my_account_data() to klar_student;
