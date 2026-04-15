-- DealerCRM — Phase 3: Companies + Activity Log + Multi-tenancy Prep
-- Adds companies table, activity_log table, and company_id FK on leads.
-- Run this in Supabase SQL Editor AFTER 002_rls_role_based.sql.

-- ═══════════════════════════════════════════════════════════════════════
-- COMPANIES — multi-tenancy: one row per dealership
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  domain     text,
  settings   jsonb default '{}',
  created_at timestamptz default now()
);

alter table companies enable row level security;

create policy "companies_select" on companies
  for select using (auth.role() = 'authenticated');

create policy "companies_insert" on companies
  for insert with check (public.user_role() = 'manager');

create policy "companies_update" on companies
  for update using (public.user_role() = 'manager');

-- Seed default company (Style Auto)
insert into companies (name, slug, domain) values
  ('Style Auto', 'style-auto', 'styleauto.ca')
on conflict (slug) do nothing;

-- ═══════════════════════════════════════════════════════════════════════
-- LEADS — add company_id column (nullable for backwards compat)
-- ═══════════════════════════════════════════════════════════════════════

alter table leads add column if not exists company_id uuid references companies(id) on delete set null;
create index if not exists leads_company_id_idx on leads (company_id);

-- Expand source CHECK constraint to allow 'website_form'
alter table leads drop constraint if exists leads_source_check;
alter table leads add constraint leads_source_check
  check (source in ('website', 'meta', 'website_form'));

-- Backfill existing leads with Style Auto company_id
update leads set company_id = (select id from companies where slug = 'style-auto')
  where company_id is null;

-- ═══════════════════════════════════════════════════════════════════════
-- ACTIVITY LOG — generic event stream per lead
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  company_id  uuid references companies(id) on delete set null,
  event_type  text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

create index if not exists activity_log_lead_id_idx on activity_log (lead_id, created_at);
create index if not exists activity_log_company_id_idx on activity_log (company_id);

alter table activity_log enable row level security;

create policy "activity_log_select" on activity_log
  for select using (auth.role() = 'authenticated');

create policy "activity_log_insert" on activity_log
  for insert with check (auth.role() = 'authenticated');

-- n8n uses service_role key and bypasses RLS automatically.
