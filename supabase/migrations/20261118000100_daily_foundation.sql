create schema rb_private;
revoke all on schema rb_private from public;

create role rb_api nologin nobypassrls;
grant usage on schema rb_private to rb_api;

create table rb_private.profiles (
  user_id uuid primary key,
  display_name text,
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  onboarding_state text not null default 'pending',
  revision integer not null default 1 check (revision >= 1)
);

create table rb_private.consent_events (
  id bigint generated always as identity primary key,
  cursor_id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references rb_private.profiles,
  purpose text not null,
  policy_version text not null,
  action text not null check (action in ('grant', 'revoke')),
  effective_at timestamptz not null default clock_timestamp()
);
create index consent_events_owner on rb_private.consent_events (user_id, id);

create table rb_private.audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references rb_private.profiles,
  consent_event_id bigint not null unique references rb_private.consent_events,
  created_at timestamptz not null default clock_timestamp()
);

create table rb_private.daily_logs (
  id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references rb_private.profiles,
  local_date date not null,
  timezone text not null,
  revision integer not null check (revision >= 1),
  definition_version_id uuid not null,
  status text not null check (status in ('partial', 'complete')),
  recorded_at timestamptz not null default clock_timestamp(),
  retrospective boolean not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  primary key (user_id, local_date)
);

create table rb_private.mutation_receipts (
  user_id uuid not null references rb_private.profiles,
  scope text not null,
  key text not null,
  request_hash text not null,
  response jsonb not null,
  primary key (user_id, scope, key)
);

do $migration$
declare relation text;
begin
  foreach relation in array array['profiles', 'consent_events', 'audit_events', 'daily_logs', 'mutation_receipts']
  loop
    execute format('alter table rb_private.%I enable row level security', relation);
    execute format('alter table rb_private.%I force row level security', relation);
    execute format(
      'create policy owner_only on rb_private.%I to rb_api
       using (user_id = nullif(current_setting(''rb.user_id'', true), '''')::uuid)
       with check (user_id = nullif(current_setting(''rb.user_id'', true), '''')::uuid)', relation);
  end loop;
end
$migration$;

grant select, insert, update on rb_private.profiles, rb_private.daily_logs to rb_api;
grant select, insert on rb_private.consent_events, rb_private.mutation_receipts to rb_api;
grant insert on rb_private.audit_events to rb_api;
grant usage on all sequences in schema rb_private to rb_api;
