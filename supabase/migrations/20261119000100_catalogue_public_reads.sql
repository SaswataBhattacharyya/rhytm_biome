-- Public catalogue documents for the synthetic pilot. Only published rows
-- are available to the runtime role. Keep private editorial data elsewhere.
create table rb_private.catalogue_entries (
  kind text not null check (kind in ('test', 'product')),
  lookup_key text not null check (length(lookup_key) between 1 and 160),
  document jsonb not null,
  published boolean not null default false,
  primary key (kind, lookup_key),
  check (
    jsonb_typeof(document) = 'object'
    and lookup_key is not distinct from
      case kind when 'test' then document ->> 'id' else document ->> 'slug' end
  )
);

alter table rb_private.catalogue_entries enable row level security;
alter table rb_private.catalogue_entries force row level security;
create policy published_only on rb_private.catalogue_entries for select to rb_api using (published);
grant select on rb_private.catalogue_entries to rb_api;
