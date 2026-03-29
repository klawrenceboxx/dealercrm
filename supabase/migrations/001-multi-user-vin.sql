-- Migration 001: Multi-user support + VIN + schema fixes
-- Run this if you already applied the original schema.sql.
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING).

-- ── Profiles table ─────────────────────────────────────────────────────────
create table if not exists profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  full_name  text,
  role       text check (role in ('admin', 'sales')) default 'sales',
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

alter table profiles enable row level security;
create policy if not exists "users can view all profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy if not exists "users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Backfill profiles for existing auth users
insert into profiles (id, full_name)
select id, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;

-- ── Leads: new columns ─────────────────────────────────────────────────────
alter table leads add column if not exists vin text;
alter table leads add column if not exists assigned_to uuid references profiles(id);
create index if not exists leads_assigned_to_idx on leads (assigned_to);

-- ── Notes: track creator ───────────────────────────────────────────────────
alter table notes add column if not exists created_by uuid references profiles(id);

-- ── Inventory: rename mileage → mileage_km, add vin + available ───────────
-- Rename existing column if it exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'inventory' and column_name = 'mileage'
  ) then
    alter table inventory rename column mileage to mileage_km;
  end if;
end $$;

alter table inventory add column if not exists vin text;
alter table inventory add column if not exists stock_number text;
alter table inventory add column if not exists added_by uuid references profiles(id);

-- Add generated available column (requires dropping/recreating if status column exists)
alter table inventory add column if not exists available boolean
  generated always as (status = 'available') stored;

create index if not exists inventory_available_idx on inventory (available);
create index if not exists inventory_vin_idx on inventory (vin);

-- Add unique constraint on vin (nullable — only enforced when vin is not null)
create unique index if not exists inventory_vin_unique_idx on inventory (vin)
  where vin is not null;
