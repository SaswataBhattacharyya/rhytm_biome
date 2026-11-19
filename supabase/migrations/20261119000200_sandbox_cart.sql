create table rb_private.sandbox_carts (
  user_id uuid primary key references rb_private.profiles,
  id uuid not null unique,
  revision integer not null default 1 check (revision >= 1),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30)
);

alter table rb_private.sandbox_carts enable row level security;
alter table rb_private.sandbox_carts force row level security;
create policy owner_only on rb_private.sandbox_carts to rb_api
  using (user_id = nullif(current_setting('rb.user_id', true), '')::uuid)
  with check (user_id = nullif(current_setting('rb.user_id', true), '')::uuid);
grant select, insert, update on rb_private.sandbox_carts to rb_api;
