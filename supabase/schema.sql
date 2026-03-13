-- DealerCRM — Supabase Schema
-- Run this in Supabase SQL Editor to set up the database.
-- Project: Eli Doueri car dealership CRM replacement (AutoRaptor)

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
  notes          text,                        -- manual notes (quick field; detailed notes in notes table)
  created_at     timestamptz default now()
);

-- Index for scheduler query (next_follow_up <= now)
create index if not exists leads_next_follow_up_idx on leads (next_follow_up)
  where opted_out = false and stage not in ('hot', 'closed', 'unsubscribed');

-- Index for inbound SMS lookup (phone → lead)
create index if not exists leads_phone_idx on leads (phone);

-- ── SMS Log ────────────────────────────────────────────────────────────────
create table if not exists sms_log (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  direction   text check (direction in ('outbound', 'inbound')) not null,
  body        text not null,
  sent_at     timestamptz default now(),
  intent_score text check (intent_score in ('cold', 'warm', 'hot')),  -- Claude's classification at this message
  demo        boolean default false,          -- true = SMS was suppressed (demo mode)
  trigger_type text                           -- first_contact, follow_up_day3, inbound_reply, etc.
);

create index if not exists sms_log_lead_id_idx on sms_log (lead_id, sent_at);

-- ── Notes ──────────────────────────────────────────────────────────────────
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  content     text not null,
  created_at  timestamptz default now()
);

create index if not exists notes_lead_id_idx on notes (lead_id);

-- ── Inventory ──────────────────────────────────────────────────────────────
-- Sleiman maintains this table. n8n reads it to build Claude's inventory context.
create table if not exists inventory (
  id       uuid primary key default gen_random_uuid(),
  vehicle  text not null,     -- full string: "2024 Toyota Camry LE"
  year     integer,
  make     text,
  model    text,
  trim     text,
  color    text,
  mileage  integer,           -- km
  price    numeric(10, 2),
  status   text check (status in ('available', 'pending', 'sold')) default 'available',
  notes    text,
  updated_at timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Single-user internal tool. Enable auth via Supabase Auth (email/password).
-- All tables are accessible only when authenticated.

alter table leads enable row level security;
alter table sms_log enable row level security;
alter table notes enable row level security;
alter table inventory enable row level security;

-- Policy: authenticated users can read/write all rows
create policy "authenticated full access" on leads
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on sms_log
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on notes
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on inventory
  for all using (auth.role() = 'authenticated');

-- ── n8n service role (bypass RLS for automation) ───────────────────────────
-- n8n uses the Supabase SERVICE_ROLE key (not anon key) so it bypasses RLS.
-- Add SUPABASE_SERVICE_ROLE_KEY to n8n environment variables.
-- The React frontend uses the ANON key + Supabase Auth session.

-- ── Sample inventory (for demo) ────────────────────────────────────────────
insert into inventory (vehicle, year, make, model, trim, color, mileage, price, status) values
  ('2024 Toyota Camry LE', 2024, 'Toyota', 'Camry', 'LE', 'Silver', 12000, 29900, 'available'),
  ('2023 Honda Civic Sport', 2023, 'Honda', 'Civic', 'Sport', 'Black', 18500, 27400, 'available'),
  ('2025 Nissan Rogue SV', 2025, 'Nissan', 'Rogue', 'SV', 'White', 0, 38200, 'available'),
  ('2022 Hyundai Tucson Preferred', 2022, 'Hyundai', 'Tucson', 'Preferred', 'Red', 31000, 29500, 'available'),
  ('2024 Ford F-150 XLT', 2024, 'Ford', 'F-150', 'XLT', 'Blue', 8200, 52000, 'available')
on conflict do nothing;
