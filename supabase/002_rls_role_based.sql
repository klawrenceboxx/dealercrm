-- DealerCRM — Phase 1: Role-Based RLS Migration
-- Replaces broad "authenticated full access" with role-aware policies.
-- n8n service_role key bypasses RLS automatically (Supabase built-in).
--
-- Run this in Supabase SQL Editor AFTER the base schema is applied.

-- ═══════════════════════════════════════════════════════════════════════
-- Helper function: get current user's role from profiles table
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- Drop existing broad policies
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists "authenticated full access" on leads;
drop policy if exists "authenticated full access" on sms_log;
drop policy if exists "authenticated full access" on notes;
drop policy if exists "authenticated full access" on inventory;
drop policy if exists "authenticated full access" on profiles;
drop policy if exists "authenticated full access" on settings;
drop policy if exists "authenticated full access" on appointments;
drop policy if exists "authenticated full access" on tasks;
drop policy if exists "authenticated full access" on templates;

-- ═══════════════════════════════════════════════════════════════════════
-- LEADS — reps and managers: full read/write
-- ═══════════════════════════════════════════════════════════════════════

create policy "leads_select" on leads
  for select using (auth.role() = 'authenticated');

create policy "leads_insert" on leads
  for insert with check (auth.role() = 'authenticated');

create policy "leads_update" on leads
  for update using (auth.role() = 'authenticated');

create policy "leads_delete" on leads
  for delete using (public.user_role() = 'manager');

-- ═══════════════════════════════════════════════════════════════════════
-- SMS_LOG — reps and managers: full read/write
-- ═══════════════════════════════════════════════════════════════════════

create policy "sms_log_select" on sms_log
  for select using (auth.role() = 'authenticated');

create policy "sms_log_insert" on sms_log
  for insert with check (auth.role() = 'authenticated');

create policy "sms_log_update" on sms_log
  for update using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- NOTES — reps and managers: full read/write
-- ═══════════════════════════════════════════════════════════════════════

create policy "notes_select" on notes
  for select using (auth.role() = 'authenticated');

create policy "notes_insert" on notes
  for insert with check (auth.role() = 'authenticated');

create policy "notes_update" on notes
  for update using (auth.role() = 'authenticated');

create policy "notes_delete" on notes
  for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- APPOINTMENTS — reps and managers: full read/write
-- ═══════════════════════════════════════════════════════════════════════

create policy "appointments_select" on appointments
  for select using (auth.role() = 'authenticated');

create policy "appointments_insert" on appointments
  for insert with check (auth.role() = 'authenticated');

create policy "appointments_update" on appointments
  for update using (auth.role() = 'authenticated');

create policy "appointments_delete" on appointments
  for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- TASKS — reps and managers: full read/write
-- ═══════════════════════════════════════════════════════════════════════

create policy "tasks_select" on tasks
  for select using (auth.role() = 'authenticated');

create policy "tasks_insert" on tasks
  for insert with check (auth.role() = 'authenticated');

create policy "tasks_update" on tasks
  for update using (auth.role() = 'authenticated');

create policy "tasks_delete" on tasks
  for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════
-- INVENTORY — all authenticated can read/write rows,
-- but cost columns are hidden via a secure view (below)
-- ═══════════════════════════════════════════════════════════════════════

create policy "inventory_select" on inventory
  for select using (auth.role() = 'authenticated');

create policy "inventory_insert" on inventory
  for insert with check (public.user_role() = 'manager');

create policy "inventory_update" on inventory
  for update using (auth.role() = 'authenticated');

create policy "inventory_delete" on inventory
  for delete using (public.user_role() = 'manager');

-- ═══════════════════════════════════════════════════════════════════════
-- INVENTORY SECURE VIEW — hides purchase_price, repair_cost for reps
-- Managers see all columns; reps see nulls for cost fields
-- ═══════════════════════════════════════════════════════════════════════

create or replace view public.inventory_view
with (security_invoker = false)
as
select
  id, vehicle, year, make, model, trim, color, mileage, price,
  status, notes, updated_at, stock_number, vin,
  case when public.user_role() = 'manager' then purchase_price else null end as purchase_price,
  case when public.user_role() = 'manager' then repair_cost    else null end as repair_cost,
  repair_notes, at_mechanic, mechanic_name, image_url
from public.inventory;

-- ═══════════════════════════════════════════════════════════════════════
-- PROFILES — reps can read all, only managers can update
-- ═══════════════════════════════════════════════════════════════════════

create policy "profiles_select" on profiles
  for select using (auth.role() = 'authenticated');

-- Allow insert for auto-create on first login (ProfileContext.jsx)
create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_self" on profiles
  for update using (auth.uid() = id);

create policy "profiles_update_manager" on profiles
  for update using (public.user_role() = 'manager');

-- ═══════════════════════════════════════════════════════════════════════
-- SETTINGS — managers only write, all authenticated read
-- ═══════════════════════════════════════════════════════════════════════

create policy "settings_select" on settings
  for select using (auth.role() = 'authenticated');

create policy "settings_insert" on settings
  for insert with check (public.user_role() = 'manager');

create policy "settings_update" on settings
  for update using (public.user_role() = 'manager');

-- ═══════════════════════════════════════════════════════════════════════
-- TEMPLATES — all authenticated read, managers write
-- ═══════════════════════════════════════════════════════════════════════

create policy "templates_select" on templates
  for select using (auth.role() = 'authenticated');

create policy "templates_insert" on templates
  for insert with check (auth.role() = 'authenticated');

create policy "templates_update" on templates
  for update using (public.user_role() = 'manager');

create policy "templates_delete" on templates
  for delete using (public.user_role() = 'manager');
