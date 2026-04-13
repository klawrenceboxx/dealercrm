-- DealerCRM — Supabase Schema
-- Run this in Supabase SQL Editor to set up the database.
-- Project: Eli Doueri car dealership CRM replacement (AutoRaptor)

-- ── Profiles (multi-user) ──────────────────────────────────────────────────
-- Linked to auth.users. Auto-created on signup via trigger below.
create table if not exists profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  name       text,
  full_name  text,
  phone      text,
  role       text check (role in ('admin', 'sales', 'manager', 'rep')) default 'rep',
  active     boolean default true,
  rr_order   integer default 0,
  shift_start_minutes integer default 540,
  shift_end_minutes integer default 1020,
  shift_timezone text default 'America/Toronto',
  created_at timestamptz default now()
);

-- Auto-create profile when a new auth user is created
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
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
create policy "users can view all profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "users can update own profile" on profiles
  for update using (auth.uid() = id);

create table if not exists settings (
  key        text primary key,
  value      jsonb not null default '0'::jsonb,
  updated_at timestamptz default now()
);

insert into settings (key, value)
values ('rr_index', '0'::jsonb)
on conflict (key) do nothing;

-- ── Leads ──────────────────────────────────────────────────────────────────
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  lead_id       text unique,                  -- legacy string ID from n8n (UUIDv4)
  first_name    text not null,
  last_name     text,
  phone         text,                         -- E.164 format: +15551234567
  email         text,
  source        text check (source in ('website', 'meta')) default 'website',
  vehicle_interest text,
  vin           text,                         -- VIN if provided by lead
  stage         text check (stage in ('new', 'contacted', 'warm', 'hot', 'closed', 'unsubscribed')) default 'new',
  intent_score  text check (intent_score in ('cold', 'warm', 'hot')),
  sequence_step integer default 0,
  next_follow_up timestamptz,                 -- n8n scheduler uses this
  last_reply_at  timestamptz,
  last_sms_at    timestamptz,
  sms_count      integer default 0,
  opted_out      boolean default false,
  salesperson_alerted boolean default false,
  demo_mode      boolean default true,        -- set to false when going live
  autopilot_active boolean default true,
  notes          text,
  assigned_to    uuid references profiles(id), -- which sales rep owns this lead
  assigned_at    timestamptz,
  rep_response_at timestamptz,
  created_at     timestamptz default now()
);

create index if not exists leads_next_follow_up_idx on leads (next_follow_up)
  where opted_out = false and stage not in ('hot', 'closed', 'unsubscribed');
create index if not exists leads_phone_idx on leads (phone);
create index if not exists leads_assigned_to_idx on leads (assigned_to);
create index if not exists leads_assigned_at_idx on leads (assigned_at);
create index if not exists leads_rep_response_at_idx on leads (rep_response_at);

-- ── SMS Log ────────────────────────────────────────────────────────────────
create table if not exists sms_log (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  direction   text check (direction in ('outbound', 'inbound')) not null,
  body        text not null,
  sent_at     timestamptz default now(),
  intent_score text check (intent_score in ('cold', 'warm', 'hot')),
  demo        boolean default false,
  trigger_type text
);

create index if not exists sms_log_lead_id_idx on sms_log (lead_id, sent_at);

-- ── Notes ──────────────────────────────────────────────────────────────────
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  content     text not null,
  created_by  uuid references profiles(id),   -- which sales rep added this note
  created_at  timestamptz default now()
);

create index if not exists notes_lead_id_idx on notes (lead_id);

-- ── Inventory ──────────────────────────────────────────────────────────────
-- Sales team manages this. n8n reads it to build Claude's inventory context.
create table if not exists inventory (
  id          uuid primary key default gen_random_uuid(),
  vin         text unique,
  year        integer,
  make        text,
  model       text,
  trim        text,
  color       text,
  mileage_km  integer default 0,
  price       numeric(10, 2),
  status      text check (status in ('available', 'pending', 'sold')) default 'available',
  available   boolean generated always as (status = 'available') stored,
  stock_number text,
  notes       text,
  added_by    uuid references profiles(id),
  updated_at  timestamptz default now()
);

create index if not exists inventory_available_idx on inventory (available);
create index if not exists inventory_vin_idx on inventory (vin);

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table leads enable row level security;
alter table sms_log enable row level security;
alter table notes enable row level security;
alter table inventory enable row level security;

create policy "authenticated full access" on leads
  for all using (auth.role() = 'authenticated');
create policy "authenticated full access" on sms_log
  for all using (auth.role() = 'authenticated');
create policy "authenticated full access" on notes
  for all using (auth.role() = 'authenticated');
create policy "authenticated full access" on inventory
  for all using (auth.role() = 'authenticated');

-- ── n8n service role (bypass RLS for automation) ───────────────────────────
-- n8n uses SUPABASE_SERVICE_ROLE_KEY — bypasses RLS entirely.
-- React frontend uses ANON key + Supabase Auth session.

-- ── Sample inventory (for demo) ────────────────────────────────────────────
insert into inventory (vin, year, make, model, trim, color, mileage_km, price, status) values
  ('1HGCM82633A004352', 2024, 'Toyota', 'Camry', 'LE', 'Silver', 12000, 29900, 'available'),
  ('2HGFG12647H537528', 2023, 'Honda', 'Civic', 'Sport', 'Black', 18500, 27400, 'available'),
  ('5N1AT2MT5FC793983', 2025, 'Nissan', 'Rogue', 'SV', 'White', 0, 38200, 'available'),
  ('KM8J3CA46NU123456', 2022, 'Hyundai', 'Tucson', 'Preferred', 'Red', 31000, 29500, 'available'),
  ('1FTEW1EP5JFA12345', 2024, 'Ford', 'F-150', 'XLT', 'Blue', 8200, 52000, 'available')
on conflict (vin) do nothing;
