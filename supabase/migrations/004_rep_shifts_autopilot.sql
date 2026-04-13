create table if not exists settings (
  key text primary key,
  value jsonb not null default '0'::jsonb,
  updated_at timestamptz default now()
);

insert into settings (key, value)
values ('rr_index', '0'::jsonb)
on conflict (key) do nothing;

alter table profiles add column if not exists name text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists active boolean not null default true;
alter table profiles add column if not exists rr_order integer not null default 0;
alter table profiles add column if not exists shift_start_minutes integer not null default 540;
alter table profiles add column if not exists shift_end_minutes integer not null default 1020;
alter table profiles add column if not exists shift_timezone text not null default 'America/Toronto';

update profiles
set
  name = coalesce(name, full_name, split_part(id::text, '-', 1)),
  full_name = coalesce(full_name, name)
where name is null or full_name is null;

alter table leads add column if not exists autopilot_active boolean not null default true;
alter table leads add column if not exists assigned_at timestamptz;
alter table leads add column if not exists rep_response_at timestamptz;

update leads
set assigned_at = coalesce(assigned_at, created_at)
where assigned_to is not null and assigned_at is null;

create index if not exists leads_assigned_at_idx on leads (assigned_at);
create index if not exists leads_rep_response_at_idx on leads (rep_response_at);
